import { describe, expect, it } from 'vitest';

import type { LinkedToolItem } from '@renderer/types/groups';
import type { ToolUseResultData } from '@renderer/types/data';
import {
  hasEditContent,
  hasReadContent,
  hasSkillInstructions,
  hasWriteContent,
} from '@renderer/utils/toolRendering/toolContentChecks';

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

function toolUseResult(data: Record<string, unknown>): ToolUseResultData {
  return data as ToolUseResultData;
}

describe('hasSkillInstructions', () => {
  it('is true when instructions are present', () => {
    expect(hasSkillInstructions(createLinkedTool({ skillInstructions: 'do this' }))).toBe(true);
  });

  it('is false when instructions are missing or empty', () => {
    expect(hasSkillInstructions(createLinkedTool())).toBe(false);
    expect(hasSkillInstructions(createLinkedTool({ skillInstructions: '' }))).toBe(false);
  });
});

describe('hasReadContent', () => {
  it('is false without a result', () => {
    expect(hasReadContent(createLinkedTool())).toBe(false);
  });

  it('is true when toolUseResult carries file content', () => {
    const tool = createLinkedTool({
      result: {
        content: '',
        isError: false,
        toolUseResult: toolUseResult({ file: { content: 'line 1' } }),
      },
    });
    expect(hasReadContent(tool)).toBe(true);
  });

  it('is true for non-empty string content', () => {
    expect(hasReadContent(createLinkedTool({ result: { content: 'text', isError: false } }))).toBe(
      true
    );
  });

  it('is false for empty string content', () => {
    expect(hasReadContent(createLinkedTool({ result: { content: '', isError: false } }))).toBe(
      false
    );
  });

  it('is true for non-empty array content', () => {
    const tool = createLinkedTool({
      result: { content: [{ type: 'text', text: 'x' }], isError: false },
    });
    expect(hasReadContent(tool)).toBe(true);
  });

  it('is false for empty array content', () => {
    expect(hasReadContent(createLinkedTool({ result: { content: [], isError: false } }))).toBe(
      false
    );
  });
});

describe('hasEditContent', () => {
  it('is true when the input has old_string', () => {
    expect(hasEditContent(createLinkedTool({ input: { old_string: 'a' } }))).toBe(true);
  });

  it('is true for an empty-string old_string', () => {
    expect(hasEditContent(createLinkedTool({ input: { old_string: '' } }))).toBe(true);
  });

  it('is true when toolUseResult carries oldString', () => {
    const tool = createLinkedTool({
      result: { content: '', isError: false, toolUseResult: toolUseResult({ oldString: 'a' }) },
    });
    expect(hasEditContent(tool)).toBe(true);
  });

  it('is true when toolUseResult carries newString', () => {
    const tool = createLinkedTool({
      result: { content: '', isError: false, toolUseResult: toolUseResult({ newString: 'b' }) },
    });
    expect(hasEditContent(tool)).toBe(true);
  });

  it('is false with neither input nor result content', () => {
    expect(hasEditContent(createLinkedTool({ input: { file_path: '/a.ts' } }))).toBe(false);
  });
});

describe('hasWriteContent', () => {
  it('is true when the input has content', () => {
    expect(hasWriteContent(createLinkedTool({ input: { content: 'x' } }))).toBe(true);
  });

  it('is true when the input has only a file path', () => {
    expect(hasWriteContent(createLinkedTool({ input: { file_path: '/a.ts' } }))).toBe(true);
  });

  it('is true when toolUseResult carries content', () => {
    const tool = createLinkedTool({
      result: { content: '', isError: false, toolUseResult: toolUseResult({ content: 'x' }) },
    });
    expect(hasWriteContent(tool)).toBe(true);
  });

  it('is true when toolUseResult carries a filePath', () => {
    const tool = createLinkedTool({
      result: { content: '', isError: false, toolUseResult: toolUseResult({ filePath: '/a.ts' }) },
    });
    expect(hasWriteContent(tool)).toBe(true);
  });

  it('is false when nothing is available', () => {
    expect(hasWriteContent(createLinkedTool())).toBe(false);
  });
});
