import { timingSafeEqual } from 'crypto';

const ALLOWED_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1']);

function parsePort(portText: string): number | undefined | null {
  if (!portText) return undefined;
  if ([...portText].some((character) => character < '0' || character > '9')) {
    return null;
  }

  const port = Number(portText);
  return Number.isSafeInteger(port) && port <= 65535 ? port : null;
}

export function isValidHostHeader(hostHeader: string | undefined, boundPort: number): boolean {
  if (hostHeader === undefined) return false;
  if (hostHeader.trim() !== hostHeader || hostHeader.includes('/')) return false;

  let hostname: string;
  let port: number | undefined;

  if (hostHeader.startsWith('[')) {
    const closingBracket = hostHeader.indexOf(']');
    if (closingBracket < 2) return false;
    hostname = hostHeader.slice(1, closingBracket);
    const portSuffix = hostHeader.slice(closingBracket + 1);
    if (portSuffix) {
      if (!portSuffix.startsWith(':')) return false;
      const portResult = parsePort(portSuffix.slice(1));
      if (portResult === null || portResult === undefined) return false;
      port = portResult;
    }
  } else if (hostHeader === '::1') {
    hostname = hostHeader;
  } else {
    const colon = hostHeader.indexOf(':');
    if (colon >= 0 && hostHeader.slice(colon + 1).includes(':')) return false;
    hostname = colon >= 0 ? hostHeader.slice(0, colon) : hostHeader;
    const portResult = parsePort(colon >= 0 ? hostHeader.slice(colon + 1) : '');
    if (portResult === null) return false;
    port = portResult;
  }

  if (!ALLOWED_HOSTNAMES.has(hostname.toLowerCase())) return false;
  return port === undefined || port === boundPort;
}

export function isValidBearerToken(
  providedToken: string | undefined,
  expectedToken: string
): boolean {
  if (!providedToken) return false;

  const provided = Buffer.from(providedToken, 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function getBearerTokens(authorization: string | undefined, requestUrl: string): string[] {
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
