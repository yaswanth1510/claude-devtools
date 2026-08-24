import { describe, expect, it } from 'vitest';

import type { ContentBlock } from '@main/types';
import { extractToolCalls, extractToolResults } from '@main/utils/toolExtraction';

describe('extractToolCalls', () => {
  it('returns an empty array for string content', () => {
    expect(extractToolCalls('plain text')).toEqual([]);
  });

  it('returns an empty array when there are no tool_use blocks', () => {
    const content: ContentBlock[] = [{ type: 'text', text: 'hello' }];
    expect(extractToolCalls(content)).toEqual([]);
  });

  it('extracts a regular tool call', () => {
    const content: ContentBlock[] = [
      { type: 'tool_use', id: 'tu-1', name: 'Read', input: { file_path: '/a.ts' } },
    ];
    expect(extractToolCalls(content)).toEqual([
      { id: 'tu-1', name: 'Read', input: { file_path: '/a.ts' }, isTask: false },
    ]);
  });

  it('extracts Task metadata for Task tool calls', () => {
    const content: ContentBlock[] = [
      {
        type: 'tool_use',
        id: 'tu-1',
        name: 'Task',
        input: { description: 'explore repo', subagent_type: 'Explore' },
      },
    ];
    expect(extractToolCalls(content)[0]).toMatchObject({
      isTask: true,
      taskDescription: 'explore repo',
      taskSubagentType: 'Explore',
    });
  });

  it('leaves Task metadata undefined when absent', () => {
    const content: ContentBlock[] = [{ type: 'tool_use', id: 'tu-1', name: 'Task', input: {} }];
    const [call] = extractToolCalls(content);
    expect(call.isTask).toBe(true);
    expect(call.taskDescription).toBeUndefined();
    expect(call.taskSubagentType).toBeUndefined();
  });

  it('defaults missing input to an empty object', () => {
    const content = [{ type: 'tool_use', id: 'tu-1', name: 'Bash' }] as unknown as ContentBlock[];
    expect(extractToolCalls(content)[0].input).toEqual({});
  });

  it('skips tool_use blocks missing an id or name', () => {
    const content = [
      { type: 'tool_use', name: 'Read', input: {} },
      { type: 'tool_use', id: 'tu-2', input: {} },
    ] as unknown as ContentBlock[];
    expect(extractToolCalls(content)).toEqual([]);
  });

  it('extracts multiple tool calls in order, ignoring other blocks', () => {
    const content: ContentBlock[] = [
      { type: 'text', text: 'let me look' },
      { type: 'tool_use', id: 'tu-1', name: 'Read', input: {} },
      { type: 'tool_use', id: 'tu-2', name: 'Bash', input: { command: 'ls' } },
    ];
    expect(extractToolCalls(content).map((c) => c.id)).toEqual(['tu-1', 'tu-2']);
  });
});

describe('extractToolResults', () => {
  it('returns an empty array for string content', () => {
    expect(extractToolResults('plain text')).toEqual([]);
  });

  it('extracts a successful tool result', () => {
    const content: ContentBlock[] = [
      { type: 'tool_result', tool_use_id: 'tu-1', content: 'file contents' },
    ];
    expect(extractToolResults(content)).toEqual([
      { toolUseId: 'tu-1', content: 'file contents', isError: false },
    ]);
  });

  it('preserves the error flag', () => {
    const content: ContentBlock[] = [
      { type: 'tool_result', tool_use_id: 'tu-1', content: 'boom', is_error: true },
    ];
    expect(extractToolResults(content)[0].isError).toBe(true);
  });

  it('preserves array content', () => {
    const blocks: ContentBlock[] = [{ type: 'text', text: 'nested' }];
    const content: ContentBlock[] = [
      { type: 'tool_result', tool_use_id: 'tu-1', content: blocks },
    ];
    expect(extractToolResults(content)[0].content).toEqual(blocks);
  });

  it('defaults missing content to an empty string', () => {
    const content = [
      { type: 'tool_result', tool_use_id: 'tu-1' },
    ] as unknown as ContentBlock[];
    expect(extractToolResults(content)[0].content).toBe('');
  });

  it('skips tool_result blocks without a tool_use_id', () => {
    const content = [{ type: 'tool_result', content: 'orphan' }] as unknown as ContentBlock[];
    expect(extractToolResults(content)).toEqual([]);
  });

  it('ignores non tool_result blocks', () => {
    const content: ContentBlock[] = [
      { type: 'text', text: 'hi' },
      { type: 'tool_result', tool_use_id: 'tu-1', content: 'ok' },
    ];
    expect(extractToolResults(content)).toHaveLength(1);
  });
});
