import { describe, expect, it } from 'vitest';

import type { ParsedMessage, Process, SemanticStep } from '@renderer/types/data';
import { extractMainModel, extractSubagentModels } from '@renderer/utils/modelExtractor';
import { parseModelString } from '@shared/utils/modelParser';

const TIMESTAMP = new Date('2025-01-01T00:00:00Z');

function toolCallStep(sourceModel: string | undefined, id = 'step-1'): SemanticStep {
  return {
    id,
    type: 'tool_call',
    startTime: TIMESTAMP,
    durationMs: 0,
    content: { toolName: 'Read', sourceModel },
    context: 'main',
  };
}

function assistantMessage(model: string | undefined): ParsedMessage {
  return {
    uuid: `msg-${model ?? 'none'}`,
    parentUuid: null,
    type: 'assistant',
    timestamp: TIMESTAMP,
    content: '',
    isSidechain: false,
    isMeta: false,
    toolCalls: [],
    toolResults: [],
    model,
  };
}

function createSubagent(messages: ParsedMessage[], id = 'agent-1'): Process {
  return {
    id,
    filePath: `/agents/${id}.jsonl`,
    messages,
    startTime: TIMESTAMP,
    endTime: TIMESTAMP,
    durationMs: 0,
    metrics: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalTokens: 0,
      messageCount: messages.length,
      durationMs: 0,
    },
    isParallel: false,
  };
}

describe('extractMainModel', () => {
  it('returns null when there are no steps', () => {
    expect(extractMainModel([])).toBeNull();
  });

  it('returns null when no step carries a model', () => {
    expect(extractMainModel([toolCallStep(undefined)])).toBeNull();
  });

  it('ignores non tool_call steps', () => {
    const step: SemanticStep = {
      id: 'step-1',
      type: 'thinking',
      startTime: TIMESTAMP,
      durationMs: 0,
      content: { thinkingText: 'hmm', sourceModel: 'claude-sonnet-4-5-20250929' },
      context: 'main',
    };
    expect(extractMainModel([step])).toBeNull();
  });

  it('ignores synthetic models', () => {
    expect(extractMainModel([toolCallStep('<synthetic>')])).toBeNull();
  });

  it('ignores unparseable models', () => {
    expect(extractMainModel([toolCallStep('gpt-4o')])).toBeNull();
  });

  it('returns the parsed model for a single step', () => {
    expect(extractMainModel([toolCallStep('claude-sonnet-4-5-20250929')])).toEqual(
      parseModelString('claude-sonnet-4-5-20250929')
    );
  });

  it('returns the most common model when usage is mixed', () => {
    const steps = [
      toolCallStep('claude-opus-4-1-20250805', 'a'),
      toolCallStep('claude-sonnet-4-5-20250929', 'b'),
      toolCallStep('claude-sonnet-4-5-20250929', 'c'),
    ];
    expect(extractMainModel(steps)?.family).toBe('sonnet');
  });
});

describe('extractSubagentModels', () => {
  const sonnet = parseModelString('claude-sonnet-4-5-20250929');

  it('returns an empty array without processes', () => {
    expect(extractSubagentModels([], sonnet)).toEqual([]);
  });

  it('collects models that differ from the main model', () => {
    const processes = [createSubagent([assistantMessage('claude-haiku-4-5-20251001')])];
    expect(extractSubagentModels(processes, sonnet).map((m) => m.family)).toEqual(['haiku']);
  });

  it('filters out the main model', () => {
    const processes = [createSubagent([assistantMessage('claude-sonnet-4-5-20250929')])];
    expect(extractSubagentModels(processes, sonnet)).toEqual([]);
  });

  it('deduplicates models across subagents', () => {
    const processes = [
      createSubagent([assistantMessage('claude-haiku-4-5-20251001')], 'a1'),
      createSubagent([assistantMessage('claude-haiku-4-5-20251001')], 'a2'),
    ];
    expect(extractSubagentModels(processes, sonnet)).toHaveLength(1);
  });

  it('uses the first assistant message with a real model', () => {
    const processes = [
      createSubagent([
        { ...assistantMessage(undefined), uuid: 'm1' },
        { ...assistantMessage('<synthetic>'), uuid: 'm2' },
        { ...assistantMessage('claude-opus-4-1-20250805'), uuid: 'm3' },
      ]),
    ];
    expect(extractSubagentModels(processes, sonnet).map((m) => m.family)).toEqual(['opus']);
  });

  it('ignores user messages carrying a model', () => {
    const userMsg: ParsedMessage = { ...assistantMessage('claude-opus-4-1-20250805'), type: 'user' };
    expect(extractSubagentModels([createSubagent([userMsg])], sonnet)).toEqual([]);
  });

  it('returns all models when there is no main model', () => {
    const processes = [createSubagent([assistantMessage('claude-sonnet-4-5-20250929')])];
    expect(extractSubagentModels(processes, null).map((m) => m.family)).toEqual(['sonnet']);
  });
});
