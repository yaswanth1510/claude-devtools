import { timingSafeEqual } from 'crypto';

const ALLOWED_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1']);

export function isValidHostHeader(hostHeader: string | undefined, boundPort: number): boolean {
  if (hostHeader === undefined) return false;
  if (hostHeader.trim() !== hostHeader || hostHeader.includes('/')) return false;

  let hostname: string;
  let port: number | undefined;

  if (hostHeader.startsWith('[')) {
    const match = /^\[([^\]]+)\](?::(\d+))?$/.exec(hostHeader);
    if (!match) return false;
    hostname = match[1];
    port = match[2] ? Number(match[2]) : undefined;
  } else if (hostHeader === '::1') {
    hostname = hostHeader;
  } else {
    const match = /^([^:]+)(?::(\d+))?$/.exec(hostHeader);
    if (!match) return false;
    hostname = match[1];
    port = match[2] ? Number(match[2]) : undefined;
  }

  if (!ALLOWED_HOSTNAMES.has(hostname.toLowerCase())) return false;
  return port === undefined || port === boundPort;
}

export function isValidBearerToken(providedToken: string | undefined, expectedToken: string): boolean {
  if (!providedToken) return false;

  const provided = Buffer.from(providedToken, 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function getBearerTokens(
  authorization: string | undefined,
  requestUrl: string
): string[] {
  const tokens: string[] = [];
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length);
    if (token && !token.includes(' ')) tokens.push(token);
  }

  try {
    const queryToken = new URL(requestUrl, 'http://127.0.0.1').searchParams.get('token');
    if (queryToken) tokens.push(queryToken);
  } catch {
    // Invalid URLs have no query token.
  }

  return tokens;
}

export function getBearerToken(
  authorization: string | undefined,
  requestUrl: string
): string | undefined {
  return getBearerTokens(authorization, requestUrl)[0];
}
