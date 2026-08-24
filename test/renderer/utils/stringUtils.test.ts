import { describe, expect, it } from 'vitest';

import { truncateMiddle } from '@renderer/utils/stringUtils';

describe('truncateMiddle', () => {
  it('returns short strings unchanged', () => {
    expect(truncateMiddle('main')).toBe('main');
  });

  it('returns strings of exactly maxLen unchanged', () => {
    const text = 'a'.repeat(25);
    expect(truncateMiddle(text)).toBe(text);
  });

  it('truncates the middle of long branch names', () => {
    expect(truncateMiddle('feature/very-long-branch-name-with-ticket-12345', 25)).toBe(
      'feature/ver...icket-12345'
    );
  });

  it('keeps the ellipsis and both ends for odd budgets', () => {
    // maxLen 10 -> 7 available chars -> 4 head + 3 tail
    expect(truncateMiddle('abcdefghijklmnop', 10)).toBe('abcd...nop');
  });

  it('keeps equal head and tail for even budgets', () => {
    // maxLen 11 -> 8 available chars -> 4 head + 4 tail
    expect(truncateMiddle('abcdefghijklmnop', 11)).toBe('abcd...mnop');
  });

  it('returns empty string as-is', () => {
    expect(truncateMiddle('')).toBe('');
  });

  it('uses a default maxLen of 25', () => {
    const result = truncateMiddle('x'.repeat(40));
    expect(result).toContain('...');
    expect(result).toHaveLength(25);
  });
});
