import { describe, expect, it } from 'vitest';

import type { ContentBlock, ParsedMessage, ToolUseResultData } from '@main/types';
import { checkMessagesOngoing } from '@main/utils/sessionStateDetection';

function assistant(content: ContentBlock[] | string, uuid = 'a'): ParsedMessage {
  return {
    uuid,
    parentUuid: null,
    type: 'assistant',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    content,
    isSidechain: false,
    isMeta: false,
    toolCalls: [],
    toolResults: [],
  };
}

function user(
  content: ContentBlock[] | string,
  overrides: Partial<ParsedMessage> = {}
): ParsedMessage {
  return {
    uuid: 'u',
    parentUuid: null,
    type: 'user',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    content,
    isSidechain: false,
    isMeta: true,
    toolCalls: [],
    toolResults: [],
    ...overrides,
  };
}

const TEXT: ContentBlock = { type: 'text', text: 'Here is the answer.' };
const THINKING: ContentBlock = { type: 'thinking', thinking: 'hmm', signature: 'sig' };

function toolUse(id: string, name = 'Read', input: Record<string, unknown> = {}): ContentBlock {
  return { type: 'tool_use', id, name, input };
}

function toolResult(id: string): ContentBlock {
  return { type: 'tool_result', tool_use_id: id, content: 'ok' };
}

describe('checkMessagesOngoing', () => {
  it('is false for no messages', () => {
    expect(checkMessagesOngoing([])).toBe(false);
  });

  it('is false when the last event is text output', () => {
    const messages = [assistant([toolUse('t1')]), user([toolResult('t1')]), assistant([TEXT])];
    expect(checkMessagesOngoing(messages)).toBe(false);
  });

  it('is true when a tool call follows the last text output', () => {
    const messages = [assistant([TEXT]), assistant([toolUse('t1')])];
    expect(checkMessagesOngoing(messages)).toBe(true);
  });

  it('is true when thinking or tool activity exists with no ending event', () => {
    expect(checkMessagesOngoing([assistant([THINKING])])).toBe(true);
    expect(checkMessagesOngoing([assistant([toolUse('t1')])])).toBe(true);
  });

  it('is true when a tool result arrives after the last text output', () => {
    const messages = [assistant([TEXT]), assistant([toolUse('t1')]), user([toolResult('t1')])];
    expect(checkMessagesOngoing(messages)).toBe(true);
  });

  it('treats ExitPlanMode as an ending event', () => {
    const messages = [assistant([THINKING]), assistant([toolUse('t1', 'ExitPlanMode')])];
    expect(checkMessagesOngoing(messages)).toBe(false);
  });

  it('treats a user interruption as an ending event', () => {
    const messages = [
      assistant([toolUse('t1')]),
      user([{ type: 'text', text: '[Request interrupted by user for tool use]' }]),
    ];
    expect(checkMessagesOngoing(messages)).toBe(false);
  });

  it('treats a rejected tool use as an ending event', () => {
    const messages = [
      assistant([toolUse('t1')]),
      user([toolResult('t1')], {
        // Claude Code writes a bare string here for rejections
        toolUseResult: 'User rejected tool use' as unknown as ToolUseResultData,
      }),
    ];
    expect(checkMessagesOngoing(messages)).toBe(false);
  });

  it('treats an approved SendMessage shutdown_response and its result as ending events', () => {
    const shutdown = toolUse('t1', 'SendMessage', { type: 'shutdown_response', approve: true });
    const messages = [assistant([THINKING]), assistant([shutdown]), user([toolResult('t1')])];
    expect(checkMessagesOngoing(messages)).toBe(false);
  });

  it('treats an unapproved shutdown_response as ordinary tool activity', () => {
    const shutdown = toolUse('t1', 'SendMessage', { type: 'shutdown_response', approve: false });
    const messages = [assistant([TEXT]), assistant([shutdown])];
    expect(checkMessagesOngoing(messages)).toBe(true);
  });

  it('ignores empty text blocks as ending events', () => {
    const messages = [assistant([{ type: 'text', text: '   ' }]), assistant([toolUse('t1')])];
    expect(checkMessagesOngoing(messages)).toBe(true);
  });

  it('ignores messages with string content', () => {
    expect(checkMessagesOngoing([assistant('plain text'), user('hello')])).toBe(false);
  });

  it('ignores tool results whose blocks lack a tool_use_id', () => {
    const messages = [
      assistant([TEXT]),
      user([{ type: 'tool_result', tool_use_id: '', content: 'ok' }]),
    ];
    expect(checkMessagesOngoing(messages)).toBe(false);
  });
});
