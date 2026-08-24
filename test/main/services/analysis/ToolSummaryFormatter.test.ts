import { describe, expect, it } from 'vitest';

import { getToolSummary } from '@main/services/analysis/ToolSummaryFormatter';

describe('getToolSummary', () => {
  it('uses the basename for file tools', () => {
    expect(getToolSummary('Read', { file_path: '/home/user/project/src/index.ts' })).toBe(
      'index.ts'
    );
    expect(getToolSummary('Edit', { file_path: 'src/app.tsx' })).toBe('app.tsx');
    expect(getToolSummary('Write', { file_path: 'notes.md' })).toBe('notes.md');
  });

  it('falls back to the tool name when the file path is missing', () => {
    expect(getToolSummary('Read', {})).toBe('Read');
  });

  it('prefers the Bash description over the command', () => {
    expect(getToolSummary('Bash', { description: 'Run tests', command: 'pnpm test' })).toBe(
      'Run tests'
    );
    expect(getToolSummary('Bash', { command: 'pnpm test' })).toBe('pnpm test');
    expect(getToolSummary('Bash', {})).toBe('Bash');
  });

  it('truncates long Bash descriptions at 50 characters', () => {
    const description = 'a'.repeat(60);
    expect(getToolSummary('Bash', { description })).toBe('a'.repeat(50) + '...');
  });

  it('quotes search patterns and truncates them at 30 characters', () => {
    expect(getToolSummary('Grep', { pattern: 'TODO' })).toBe('"TODO"');
    expect(getToolSummary('Glob', { pattern: '**/*.ts' })).toBe('"**/*.ts"');
    expect(getToolSummary('Grep', { pattern: 'b'.repeat(40) })).toBe(`"${'b'.repeat(30)}..."`);
    expect(getToolSummary('Glob', {})).toBe('Glob');
  });

  it('prefixes Task summaries with the subagent type', () => {
    expect(
      getToolSummary('Task', { description: 'Explore the repo', subagent_type: 'Explore' })
    ).toBe('Explore - Explore the repo');
    expect(getToolSummary('Task', { prompt: 'Do the thing' })).toBe('Do the thing');
    expect(getToolSummary('Task', { subagent_type: 'Plan' })).toBe('Plan');
    expect(getToolSummary('Task', {})).toBe('Task');
  });

  it('summarizes Skill calls by skill name', () => {
    expect(getToolSummary('Skill', { skill: 'managing-playbooks' })).toBe('managing-playbooks');
    expect(getToolSummary('Skill', {})).toBe('Skill');
  });

  it('summarizes WebFetch by host and path', () => {
    expect(getToolSummary('WebFetch', { url: 'https://example.com/docs/page?q=1' })).toBe(
      'example.com/docs/page'
    );
    expect(getToolSummary('WebFetch', { url: 'not a url' })).toBe('not a url');
    expect(getToolSummary('WebFetch', {})).toBe('WebFetch');
  });

  it('quotes web search queries', () => {
    expect(getToolSummary('WebSearch', { query: 'vitest coverage' })).toBe('"vitest coverage"');
    expect(getToolSummary('WebSearch', {})).toBe('WebSearch');
  });

  it('falls back to common input fields for unknown tools', () => {
    expect(getToolSummary('CustomTool', { name: 'thing' })).toBe('thing');
    expect(getToolSummary('CustomTool', { path: '/tmp/x' })).toBe('/tmp/x');
    expect(getToolSummary('CustomTool', { file: 'f.txt' })).toBe('f.txt');
    expect(getToolSummary('CustomTool', { query: 'q' })).toBe('q');
    expect(getToolSummary('CustomTool', { command: 'ls' })).toBe('ls');
    expect(getToolSummary('CustomTool', { other: 1 })).toBe('CustomTool');
  });
});
