import { describe, expect, it } from 'vitest';

import type { LinkedToolItem } from '@renderer/types/groups';
import { getToolContextTokens, getToolStatus } from '@renderer/utils/toolRendering/toolTokens';

function createLinkedTool(overrides: Partial<LinkedToolItem> = {}): LinkedToolItem {
  return {
    id: 'tu-1',
    name: 'Read',
    input: {},
    inputPreview: '',
    startTime: new Date('2025-01-01T00:00:00Z'),
    isOrphaned: false,
    ...overrides,
  };
}

describe('getToolContextTokens', () => {
  it('sums pre-computed call and result token counts', () => {
    const tool = createLinkedTool({
      callTokens: 30,
      result: { content: 'ignored', isError: false, tokenCount: 70 },
    });
    expect(getToolContextTokens(tool)).toBe(100);
  });

  it('estimates call tokens from the input when callTokens is missing', () => {
    // JSON.stringify({ file_path: '/a.ts' }) is 24 chars -> ceil(24/4) = 6
    const tool = createLinkedTool({ input: { file_path: '/a.ts' } });
    expect(getToolContextTokens(tool)).toBe(6);
  });

  it('estimates result tokens from string content when tokenCount is missing', () => {
    const tool = createLinkedTool({
      callTokens: 0,
      result: { content: 'a'.repeat(40), isError: false },
    });
    expect(getToolContextTokens(tool)).toBe(10);
  });

  it('estimates result tokens from array content', () => {
    const content = [{ type: 'text', text: 'hello' }];
    const tool = createLinkedTool({ callTokens: 0, result: { content, isError: false } });
    expect(getToolContextTokens(tool)).toBe(Math.ceil(JSON.stringify(content).length / 4));
  });

  it('ignores an empty result', () => {
    expect(getToolContextTokens(createLinkedTool({ callTokens: 5 }))).toBe(5);
  });

  it('adds pre-computed skill instruction tokens for Skill tools', () => {
    const tool = createLinkedTool({
      name: 'Skill',
      callTokens: 10,
      skillInstructions: 'ignored because count is provided',
      skillInstructionsTokenCount: 25,
    });
    expect(getToolContextTokens(tool)).toBe(35);
  });

  it('estimates skill instruction tokens when the count is missing', () => {
    const tool = createLinkedTool({
      name: 'Skill',
      callTokens: 10,
      skillInstructions: 'b'.repeat(20),
    });
    expect(getToolContextTokens(tool)).toBe(15);
  });

  it('ignores skill instructions for non-Skill tools', () => {
    const tool = createLinkedTool({
      name: 'Read',
      callTokens: 10,
      skillInstructionsTokenCount: 25,
    });
    expect(getToolContextTokens(tool)).toBe(10);
  });
});

describe('getToolStatus', () => {
  it('reports orphaned calls', () => {
    expect(getToolStatus(createLinkedTool({ isOrphaned: true }))).toBe('orphaned');
  });

  it('prefers orphaned over error', () => {
    const tool = createLinkedTool({
      isOrphaned: true,
      result: { content: '', isError: true },
    });
    expect(getToolStatus(tool)).toBe('orphaned');
  });

  it('reports errored results', () => {
    const tool = createLinkedTool({ result: { content: 'boom', isError: true } });
    expect(getToolStatus(tool)).toBe('error');
  });

  it('reports ok for successful results', () => {
    const tool = createLinkedTool({ result: { content: 'ok', isError: false } });
    expect(getToolStatus(tool)).toBe('ok');
  });

  it('reports ok when there is no result yet', () => {
    expect(getToolStatus(createLinkedTool())).toBe('ok');
  });
});
