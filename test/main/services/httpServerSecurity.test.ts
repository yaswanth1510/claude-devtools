import { describe, expect, it } from 'vitest';

import {
  getBearerToken,
  isValidBearerToken,
  isValidHostHeader,
} from '../../../src/main/services/infrastructure/HttpServerSecurity';

describe('HTTP server security guards', () => {
  const token = 'a'.repeat(64);

  describe('Host header guard', () => {
    it('accepts allowed hostnames with the bound port', () => {
      expect(isValidHostHeader('127.0.0.1:3456', 3456)).toBe(true);
      expect(isValidHostHeader('localhost:3456', 3456)).toBe(true);
      expect(isValidHostHeader('[::1]:3456', 3456)).toBe(true);
    });

    it('accepts allowed hostnames without an explicit port', () => {
      expect(isValidHostHeader('localhost', 3456)).toBe(true);
      expect(isValidHostHeader('::1', 3456)).toBe(true);
    });

    it('rejects bad hosts and ports', () => {
      expect(isValidHostHeader('evil.example:3456', 3456)).toBe(false);
      expect(isValidHostHeader('127.0.0.1:3457', 3456)).toBe(false);
      expect(isValidHostHeader(undefined, 3456)).toBe(false);
      expect(isValidHostHeader('[::1', 3456)).toBe(false);
    });
  });

  describe('token guard', () => {
    it('accepts a matching Authorization bearer token', () => {
      const provided = getBearerToken(`Bearer ${token}`, '/api/version');
      expect(isValidBearerToken(provided, token)).toBe(true);
    });

    it('accepts a matching query token', () => {
      const provided = getBearerToken(undefined, `/api/events?token=${token}`);
      expect(isValidBearerToken(provided, token)).toBe(true);
    });

    it('rejects missing and wrong tokens', () => {
      expect(isValidBearerToken(undefined, token)).toBe(false);
      expect(isValidBearerToken('wrong', token)).toBe(false);
      expect(isValidBearerToken(getBearerToken('Basic abc', '/api/version'), token)).toBe(false);
    });
  });
});
