import { describe, expect, it } from 'vitest';

import { parseAllTeammateMessages } from '@shared/utils/teammateMessageParser';

describe('parseAllTeammateMessages', () => {
  it('returns an empty array when there are no teammate blocks', () => {
    expect(parseAllTeammateMessages('plain user message')).toEqual([]);
  });

  it('parses a block with all attributes', () => {
    const raw =
      '<teammate-message teammate_id="agent-1" color="blue" summary="status update">' +
      '  Build is green.  ' +
      '</teammate-message>';

    expect(parseAllTeammateMessages(raw)).toEqual([
      {
        teammateId: 'agent-1',
        color: 'blue',
        summary: 'status update',
        content: 'Build is green.',
      },
    ]);
  });

  it('defaults color and summary to empty strings when absent', () => {
    const raw = '<teammate-message teammate_id="agent-1">hi</teammate-message>';
    expect(parseAllTeammateMessages(raw)).toEqual([
      { teammateId: 'agent-1', color: '', summary: '', content: 'hi' },
    ]);
  });

  it('parses multiple blocks in one message', () => {
    const raw =
      '<teammate-message teammate_id="a" color="red" summary="one">first</teammate-message>\n' +
      'noise between blocks\n' +
      '<teammate-message teammate_id="b" color="cyan" summary="two">second</teammate-message>';

    const parsed = parseAllTeammateMessages(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((p) => p.teammateId)).toEqual(['a', 'b']);
    expect(parsed.map((p) => p.content)).toEqual(['first', 'second']);
  });

  it('preserves multiline content', () => {
    const raw =
      '<teammate-message teammate_id="a">line one\nline two</teammate-message>';
    expect(parseAllTeammateMessages(raw)[0].content).toBe('line one\nline two');
  });

  it('is not greedy across adjacent blocks', () => {
    const raw =
      '<teammate-message teammate_id="a">first</teammate-message>' +
      '<teammate-message teammate_id="b">second</teammate-message>';
    expect(parseAllTeammateMessages(raw).map((p) => p.content)).toEqual(['first', 'second']);
  });

  it('ignores unterminated blocks', () => {
    expect(parseAllTeammateMessages('<teammate-message teammate_id="a">no end')).toEqual([]);
  });

  it('is stateless across calls', () => {
    const raw = '<teammate-message teammate_id="a">hi</teammate-message>';
    expect(parseAllTeammateMessages(raw)).toHaveLength(1);
    expect(parseAllTeammateMessages(raw)).toHaveLength(1);
  });
});
