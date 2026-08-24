import { createHmac } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  KnownHostsVerifier,
  parseKnownHosts,
} from '../../../src/main/services/infrastructure/KnownHostsVerifier';

const key = Buffer.from('known-host-key');
const keyBase64 = key.toString('base64');
const tempFiles: string[] = [];

function writeKnownHosts(content: string): string {
  const filePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'known-hosts-test-')),
    'known_hosts'
  );
  fs.writeFileSync(filePath, content, 'utf8');
  tempFiles.push(path.dirname(filePath));
  return filePath;
}

async function verifierFor(content: string): Promise<KnownHostsVerifier> {
  const verifier = new KnownHostsVerifier(writeKnownHosts(content));
  await verifier.load();
  return verifier;
}

afterEach(() => {
  for (const filePath of tempFiles.splice(0)) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }
});

describe('KnownHostsVerifier', () => {
  it('parses and matches a plain hostname entry', async () => {
    const verifier = await verifierFor(`example.com,192.0.2.1 ssh-ed25519 ${keyBase64}`);
    expect(() => verifier.verify('example.com', 22, key)).not.toThrow();
    expect(() => verifier.verify('192.0.2.1', 22, key)).not.toThrow();
    expect(parseKnownHosts(`example.com ssh-ed25519 ${keyBase64}`)).toHaveLength(1);
  });

  it('matches hashed hostname entries', async () => {
    const salt = Buffer.from('known-host-salt');
    const hash = createHmac('sha1', salt).update('example.com').digest('base64');
    const verifier = await verifierFor(
      `|1|${salt.toString('base64')}|${hash} ssh-ed25519 ${keyBase64}`
    );
    expect(() => verifier.verify('example.com', 22, key)).not.toThrow();
  });

  it('matches bracketed non-default ports', async () => {
    const verifier = await verifierFor(`[example.com]:2200 ssh-ed25519 ${keyBase64}`);
    expect(() => verifier.verify('example.com', 2200, key)).not.toThrow();
    expect(() => verifier.verify('example.com', 22, key)).toThrow('not present');
  });

  it('rejects a mismatched key as a possible MITM', async () => {
    const verifier = await verifierFor(`example.com ssh-ed25519 ${keyBase64}`);
    expect(() => verifier.verify('example.com', 22, Buffer.from('different'))).toThrow(
      'possible MITM'
    );
  });

  it('rejects revoked entries', async () => {
    const verifier = await verifierFor(`@revoked example.com ssh-ed25519 ${keyBase64}`);
    expect(() => verifier.verify('example.com', 22, key)).toThrow('revoked');
  });

  it('rejects unknown hosts with an actionable error', async () => {
    const verifier = await verifierFor(`example.com ssh-ed25519 ${keyBase64}`);
    expect(() => verifier.verify('other.example.com', 22, key)).toThrow('ssh-keyscan');
  });

  it('fails closed when known_hosts is missing', async () => {
    const filePath = path.join(os.tmpdir(), `missing-known-hosts-${Date.now()}`);
    const verifier = new KnownHostsVerifier(filePath);
    await expect(verifier.load()).rejects.toThrow('missing or unreadable');
  });
});
