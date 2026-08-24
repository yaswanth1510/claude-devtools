import { describe, expect, it } from 'vitest';

import {
  extractToolUseField,
  getContentBlocks,
  matchesIgnorePatterns,
  matchesPattern,
} from '@main/services/error/TriggerMatcher';
import type { ParsedMessage } from '@main/types';

function createMessage(overrides: Partial<ParsedMessage>): ParsedMessage {
  return {
    uuid: 'msg-1',
    parentUuid: null,
    type: 'assistant',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    content: '',
    isSidechain: false,
    isMeta: false,
    toolCalls: [],
    toolResults: [],
    ...overrides,
  };
}

describe('matchesPattern', () => {
  it('matches a simple substring pattern', () => {
    expect(matchesPattern('Error: build failed', 'build failed')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(matchesPattern('ERROR: TIMEOUT', 'timeout')).toBe(true);
  });

  it('matches regex syntax', () => {
    expect(matchesPattern('exit code 137', 'exit code \\d+')).toBe(true);
  });

  it('returns false when the pattern does not match', () => {
    expect(matchesPattern('all good', 'failed')).toBe(false);
  });

  it('rejects invalid patterns instead of throwing', () => {
    expect(matchesPattern('anything', '([unclosed')).toBe(false);
  });

  it('rejects ReDoS-prone patterns', () => {
    expect(matchesPattern('aaaaaaaaaaaaaaaaaaaa!', '(a+)+')).toBe(false);
  });
});

describe('matchesIgnorePatterns', () => {
  it('returns false when no patterns are provided', () => {
    expect(matchesIgnorePatterns('error')).toBe(false);
  });

  it('returns false for an empty pattern list', () => {
    expect(matchesIgnorePatterns('error', [])).toBe(false);
  });

  it('returns true when any pattern matches', () => {
    expect(matchesIgnorePatterns('npm WARN deprecated', ['^info', 'warn'])).toBe(true);
  });

  it('returns false when no pattern matches', () => {
    expect(matchesIgnorePatterns('fatal error', ['^info', 'warn'])).toBe(false);
  });

  it('skips invalid patterns and keeps checking the rest', () => {
    expect(matchesIgnorePatterns('warn: x', ['([bad', 'warn'])).toBe(true);
  });

  it('returns false when every pattern is invalid', () => {
    expect(matchesIgnorePatterns('warn: x', ['([bad'])).toBe(false);
  });
});

describe('extractToolUseField', () => {
  it('returns null when no field is requested', () => {
    expect(extractToolUseField({ name: 'Bash', input: { command: 'ls' } })).toBeNull();
  });

  it('returns null when the tool has no input', () => {
    expect(extractToolUseField({ name: 'Bash' }, 'command')).toBeNull();
  });

  it('returns string field values directly', () => {
    expect(extractToolUseField({ name: 'Bash', input: { command: 'pnpm test' } }, 'command')).toBe(
      'pnpm test'
    );
  });

  it('stringifies non-string field values', () => {
    expect(extractToolUseField({ name: 'Read', input: { limit: 20 } }, 'limit')).toBe('20');
    expect(
      extractToolUseField({ name: 'TodoWrite', input: { todos: [{ id: 1 }] } }, 'todos')
    ).toBe('[{"id":1}]');
  });

  it('returns null for missing fields', () => {
    expect(extractToolUseField({ name: 'Bash', input: { command: 'ls' } }, 'pattern')).toBeNull();
  });
});

describe('getContentBlocks', () => {
  it('returns array content as-is', () => {
    const blocks = [{ type: 'text' as const, text: 'hello' }];
    expect(getContentBlocks(createMessage({ content: blocks }))).toEqual(blocks);
  });

  it('returns an empty array for string content', () => {
    expect(getContentBlocks(createMessage({ content: 'hello' }))).toEqual([]);
  });

  it('returns an empty array for empty array content', () => {
    expect(getContentBlocks(createMessage({ content: [] }))).toEqual([]);
  });
});
