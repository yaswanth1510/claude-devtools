import { describe, expect, it } from 'vitest';

import type { Process } from '@renderer/types/data';
import type { AIGroupDisplayItem, LinkedToolItem, SlashItem } from '@renderer/types/groups';
import { buildSummary } from '@renderer/utils/displaySummary';

const TIMESTAMP = new Date('2025-01-01T00:00:00Z');

function createSubagent(overrides: Partial<Process> = {}): Process {
  return {
    id: 'agent-1',
    filePath: '/agents/agent-1.jsonl',
    messages: [],
    startTime: TIMESTAMP,
    endTime: TIMESTAMP,
    durationMs: 0,
    metrics: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 0,
      messageCount: 0,
      durationMs: 0,
    },
    isParallel: false,
    ...overrides,
  };
}

function toolItem(id: string): AIGroupDisplayItem {
  const tool: LinkedToolItem = {
    id,
    name: 'Read',
    input: {},
    inputPreview: '',
    startTime: TIMESTAMP,
    isOrphaned: false,
  };
  return { type: 'tool', tool };
}

function slashItem(id: string): AIGroupDisplayItem {
  const slash: SlashItem = {
    id,
    name: 'model',
    commandMessageUuid: `uuid-${id}`,
    timestamp: TIMESTAMP,
  };
  return { type: 'slash', slash };
}

function teammateMessageItem(id: string): AIGroupDisplayItem {
  return {
    type: 'teammate_message',
    teammateMessage: {
      id,
      teammateId: 'tm-1',
      color: 'blue',
      summary: 'status',
      content: 'done',
      timestamp: TIMESTAMP,
    },
  };
}

describe('buildSummary', () => {
  it('returns a placeholder for no items', () => {
    expect(buildSummary([])).toBe('No items');
  });

  it('uses singular wording for single items', () => {
    const items: AIGroupDisplayItem[] = [
      { type: 'thinking', content: 'hmm', timestamp: TIMESTAMP },
      toolItem('tu-1'),
      { type: 'output', content: 'done', timestamp: TIMESTAMP },
      { type: 'subagent', subagent: createSubagent() },
      slashItem('s-1'),
      teammateMessageItem('tm-msg-1'),
    ];
    expect(buildSummary(items)).toBe(
      '1 thinking, 1 tool call, 1 message, 1 subagent, 1 slash, 1 teammate message'
    );
  });

  it('pluralizes counts above one', () => {
    const items: AIGroupDisplayItem[] = [
      toolItem('tu-1'),
      toolItem('tu-2'),
      { type: 'output', content: 'a', timestamp: TIMESTAMP },
      { type: 'output', content: 'b', timestamp: TIMESTAMP },
      { type: 'subagent', subagent: createSubagent({ id: 'a1' }) },
      { type: 'subagent', subagent: createSubagent({ id: 'a2' }) },
      slashItem('s-1'),
      slashItem('s-2'),
      teammateMessageItem('tm-1'),
      teammateMessageItem('tm-2'),
    ];
    expect(buildSummary(items)).toBe(
      '2 tool calls, 2 messages, 2 subagents, 2 slashes, 2 teammate messages'
    );
  });

  it('omits zero counts', () => {
    expect(buildSummary([toolItem('tu-1')])).toBe('1 tool call');
  });

  it('counts distinct teammates separately from subagents', () => {
    const items: AIGroupDisplayItem[] = [
      {
        type: 'subagent',
        subagent: createSubagent({
          id: 'a1',
          team: { teamName: 'alpha', memberName: 'bob', memberColor: 'blue' },
        }),
      },
      {
        type: 'subagent',
        subagent: createSubagent({
          id: 'a2',
          team: { teamName: 'alpha', memberName: 'bob', memberColor: 'blue' },
        }),
      },
      {
        type: 'subagent',
        subagent: createSubagent({
          id: 'a3',
          team: { teamName: 'alpha', memberName: 'ann', memberColor: 'red' },
        }),
      },
      { type: 'subagent', subagent: createSubagent({ id: 'a4' }) },
    ];
    expect(buildSummary(items)).toBe('2 teammates, 1 subagent');
  });

  it('orders parts as thinking, tools, messages, teammates, subagents, slashes', () => {
    const items: AIGroupDisplayItem[] = [
      slashItem('s-1'),
      { type: 'subagent', subagent: createSubagent({ id: 'a1' }) },
      {
        type: 'subagent',
        subagent: createSubagent({
          id: 'a2',
          team: { teamName: 'alpha', memberName: 'bob', memberColor: 'blue' },
        }),
      },
      { type: 'output', content: 'done', timestamp: TIMESTAMP },
      toolItem('tu-1'),
      { type: 'thinking', content: 'hmm', timestamp: TIMESTAMP },
    ];
    expect(buildSummary(items)).toBe(
      '1 thinking, 1 tool call, 1 message, 1 teammate, 1 subagent, 1 slash'
    );
  });
});
