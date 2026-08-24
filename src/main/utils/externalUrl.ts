const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function isAllowedExternalProtocol(protocol: string): boolean {
  return ALLOWED_EXTERNAL_PROTOCOLS.has(protocol.toLowerCase());
}
