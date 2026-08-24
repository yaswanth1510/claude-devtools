import { describe, expect, it } from 'vitest';

import type { Process } from '@renderer/types/data';
import type { LinkedToolItem } from '@renderer/types/groups';
import {
  attachMainSessionImpact,
  formatToolInput,
  formatToolResult,
  toDate,
  truncateText,
} from '@renderer/utils/aiGroupHelpers';

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

function createTaskTool(overrides: Partial<LinkedToolItem> = {}): LinkedToolItem {
  return {
    id: 'task-1',
    name: 'Task',
    input: {},
    inputPreview: '',
    startTime: TIMESTAMP,
    isOrphaned: false,
    ...overrides,
  };
}

describe('toDate', () => {
  it('returns Date instances unchanged', () => {
    expect(toDate(TIMESTAMP)).toBe(TIMESTAMP);
  });

  it('parses ISO strings', () => {
    expect(toDate('2025-01-01T00:00:00.000Z').toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('parses epoch milliseconds', () => {
    expect(toDate(TIMESTAMP.getTime()).getTime()).toBe(TIMESTAMP.getTime());
  });
});

describe('truncateText', () => {
  it('returns short text unchanged', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('returns text of exactly maxLength unchanged', () => {
    expect(truncateText('hello', 5)).toBe('hello');
  });

  it('appends an ellipsis when truncating', () => {
    expect(truncateText('hello world', 5)).toBe('hello...');
  });
});

describe('formatToolInput', () => {
  it('pretty-prints the input as JSON', () => {
    expect(formatToolInput({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('truncates long inputs at 100 characters', () => {
    const result = formatToolInput({ text: 'x'.repeat(200) });
    expect(result).toHaveLength(103);
    expect(result.endsWith('...')).toBe(true);
  });

  it('reports invalid JSON for circular structures', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatToolInput(circular)).toBe('[Invalid JSON]');
  });
});

describe('formatToolResult', () => {
  it('returns short string content unchanged', () => {
    expect(formatToolResult('ok')).toBe('ok');
  });

  it('truncates long string content at 200 characters', () => {
    const result = formatToolResult('y'.repeat(500));
    expect(result).toBe('y'.repeat(200) + '...');
  });

  it('pretty-prints array content', () => {
    expect(formatToolResult([1, 2])).toBe('[\n  1,\n  2\n]');
  });

  it('reports invalid content for circular arrays', () => {
    const circular: unknown[] = [];
    circular.push(circular);
    expect(formatToolResult(circular)).toBe('[Invalid content]');
  });
});

describe('attachMainSessionImpact', () => {
  it('attaches call and result tokens from the spawning Task tool', () => {
    const subagents = [createSubagent({ parentTaskId: 'task-1' })];
    const linkedTools = new Map<string, LinkedToolItem>([
      [
        'task-1',
        createTaskTool({ callTokens: 120, result: { content: '', isError: false, tokenCount: 80 } }),
      ],
    ]);

    const [subagent] = attachMainSessionImpact(subagents, linkedTools);
    expect(subagent.mainSessionImpact).toEqual({
      callTokens: 120,
      resultTokens: 80,
      totalTokens: 200,
    });
  });

  it('defaults missing token counts to zero', () => {
    const subagents = [createSubagent({ parentTaskId: 'task-1' })];
    const linkedTools = new Map<string, LinkedToolItem>([['task-1', createTaskTool()]]);

    expect(attachMainSessionImpact(subagents, linkedTools)[0].mainSessionImpact).toEqual({
      callTokens: 0,
      resultTokens: 0,
      totalTokens: 0,
    });
  });

  it('leaves subagents without a parent task untouched', () => {
    const subagents = [createSubagent()];
    expect(attachMainSessionImpact(subagents, new Map())[0].mainSessionImpact).toBeUndefined();
  });

  it('leaves subagents untouched when the Task tool is unknown', () => {
    const subagents = [createSubagent({ parentTaskId: 'missing' })];
    const linkedTools = new Map<string, LinkedToolItem>([['task-1', createTaskTool()]]);
    expect(
      attachMainSessionImpact(subagents, linkedTools)[0].mainSessionImpact
    ).toBeUndefined();
  });

  it('returns the same array instance', () => {
    const subagents = [createSubagent()];
    expect(attachMainSessionImpact(subagents, new Map())).toBe(subagents);
  });
});
