import { createHmac, timingSafeEqual } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface KnownHostEntry {
  marker: string | null;
  hostPatterns: string[];
  keyType: string;
  key: Buffer;
}

function decodeBase64(value: string): Buffer | null {
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length > 0 && decoded.toString('base64') === value ? decoded : null;
  } catch {
    return null;
  }
}

export function parseKnownHosts(content: string): KnownHostEntry[] {
  const entries: KnownHostEntry[] = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const fields = trimmed.split(/\s+/);
    const marker = fields[0].startsWith('@') ? (fields.shift() ?? null) : null;
    if (fields.length < 3) continue;

    const [hosts, keyType, encodedKey] = fields;
    const key = decodeBase64(encodedKey);
    if (!key) continue;

    entries.push({
      marker,
      hostPatterns: hosts.split(','),
      keyType,
      key,
    });
  }

  return entries;
}

function normalizeHost(host: string): string {
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1).toLowerCase();
  }
  return host.toLowerCase();
}

function formatHostWithPort(host: string, port: number): string {
  return host.includes(':') ? `[${normalizeHost(host)}]:${port}` : `${normalizeHost(host)}:${port}`;
}

function isDecimal(value: string): boolean {
  return value.length > 0 && [...value].every((character) => character >= '0' && character <= '9');
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function hashedHostMatches(pattern: string, candidates: string[]): boolean {
  const fields = pattern.split('|');
  if (fields.length !== 4 || fields[1] !== '1') return false;

  const salt = decodeBase64(fields[2]);
  const expectedHash = decodeBase64(fields[3]);
  if (!salt || !expectedHash) return false;

  return candidates.some((candidate) =>
    safeEqual(createHmac('sha1', salt).update(candidate).digest(), expectedHash)
  );
}

function hostPatternMatches(pattern: string, host: string, port: number): boolean {
  const normalizedHost = normalizeHost(host);
  if (pattern.startsWith('|1|')) {
    return hashedHostMatches(pattern, [
      normalizedHost,
      formatHostWithPort(normalizedHost, port),
      `[${normalizedHost}]:${port}`,
    ]);
  }

  if (pattern.startsWith('[')) {
    const closingBracket = pattern.indexOf(']');
    if (closingBracket < 2 || pattern[closingBracket + 1] !== ':') return false;
    const bracketedHost = pattern.slice(1, closingBracket);
    const portText = pattern.slice(closingBracket + 2);
    if (!isDecimal(portText)) return false;
    return normalizeHost(bracketedHost) === normalizedHost && Number(portText) === port;
  }

  return normalizeHost(pattern) === normalizedHost && port === 22;
}

export class KnownHostsVerifier {
  private entries: KnownHostEntry[] | null = null;

  constructor(private readonly knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts')) {}

  async load(): Promise<void> {
    try {
      const content = await fs.promises.readFile(this.knownHostsPath, 'utf8');
      this.entries = parseKnownHosts(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot verify SSH host key: known_hosts file is missing or unreadable at ${this.knownHostsPath}: ${message}`
      );
    }
  }

  verify(host: string, port: number, hostKey: Buffer | string): void {
    if (!this.entries) {
      throw new Error('Cannot verify SSH host key: known_hosts has not been loaded');
    }

    const key = Buffer.isBuffer(hostKey) ? hostKey : decodeBase64(hostKey);
    if (!key) {
      throw new Error(`Cannot verify SSH host key for ${host}:${port}: invalid host key`);
    }

    const matchingEntries = this.entries.filter((entry) =>
      entry.hostPatterns.some((pattern) => hostPatternMatches(pattern, host, port))
    );
    const revoked = matchingEntries.find((entry) => entry.marker === '@revoked');
    if (revoked) {
      throw new Error(
        `SSH host key for ${host}:${port} is revoked; possible MITM attack.`
      );
    }

    if (matchingEntries.some((entry) => safeEqual(entry.key, key))) return;

    if (matchingEntries.length > 0) {
      throw new Error(
        `SSH host key mismatch for ${host}:${port}; possible MITM attack.`
      );
    }

    throw new Error(
      `SSH host ${host}:${port} is not present in known_hosts. Add the host first using "ssh ${host}" or "ssh-keyscan ${host} >> ${this.knownHostsPath}".`
    );
  }
}
