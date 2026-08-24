import { describe, expect, it } from 'vitest';

import { getErrorMessage } from '@shared/utils/errorHandling';

describe('getErrorMessage', () => {
  it('extracts the message from an Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('extracts the message from an Error subclass', () => {
    class ParseError extends Error {}
    expect(getErrorMessage(new ParseError('bad jsonl'))).toBe('bad jsonl');
  });

  it('returns strings as-is', () => {
    expect(getErrorMessage('plain failure')).toBe('plain failure');
  });

  it('reads the message property of error-like objects', () => {
    expect(getErrorMessage({ message: 'ipc failed' })).toBe('ipc failed');
  });

  it('stringifies non-string message properties', () => {
    expect(getErrorMessage({ message: 42 })).toBe('42');
  });

  it('stringifies plain objects without a message', () => {
    expect(getErrorMessage({ code: 'ENOENT' })).toBe('[object Object]');
  });

  it('stringifies primitives', () => {
    expect(getErrorMessage(404)).toBe('404');
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
  });
});
