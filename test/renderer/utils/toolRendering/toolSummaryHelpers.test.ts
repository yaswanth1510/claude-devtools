import { describe, expect, it } from 'vitest';

import { getToolSummary } from '@renderer/utils/toolRendering/toolSummaryHelpers';

describe('getToolSummary', () => {
  describe('Edit', () => {
    it('falls back to the tool name without a file path', () => {
      expect(getToolSummary('Edit', {})).toBe('Edit');
    });

    it('shows the file name when only a path is given', () => {
      expect(getToolSummary('Edit', { file_path: '/a/b/App.tsx' })).toBe('App.tsx');
    });

    it('shows a single line count when the line counts match', () => {
      expect(
        getToolSummary('Edit', { file_path: '/a/App.tsx', old_string: 'a', new_string: 'b' })
      ).toBe('App.tsx - 1 line');
    });

    it('pluralizes matching multi-line edits', () => {
      expect(
        getToolSummary('Edit', {
          file_path: '/a/App.tsx',
          old_string: 'a\nb',
          new_string: 'c\nd',
        })
      ).toBe('App.tsx - 2 lines');
    });

    it('shows the line delta when the counts differ', () => {
      expect(
        getToolSummary('Edit', { file_path: '/a/App.tsx', old_string: 'a', new_string: 'b\nc' })
      ).toBe('App.tsx - 1 -> 2 lines');
    });
  });

  describe('Read', () => {
    it('falls back to the tool name without a file path', () => {
      expect(getToolSummary('Read', {})).toBe('Read');
    });

    it('shows the file name', () => {
      expect(getToolSummary('Read', { file_path: '/a/b/notes.md' })).toBe('notes.md');
    });

    it('shows the line range using the offset', () => {
      expect(getToolSummary('Read', { file_path: '/a/x.ts', limit: 10, offset: 5 })).toBe(
        'x.ts - lines 5-14'
      );
    });

    it('defaults the range start to line 1', () => {
      expect(getToolSummary('Read', { file_path: '/a/x.ts', limit: 10 })).toBe('x.ts - lines 1-10');
    });
  });

  describe('Write', () => {
    it('falls back to the tool name without a file path', () => {
      expect(getToolSummary('Write', {})).toBe('Write');
    });

    it('shows the line count of the written content', () => {
      expect(getToolSummary('Write', { file_path: '/a/x.ts', content: 'a\nb\nc' })).toBe(
        'x.ts - 3 lines'
      );
    });

    it('shows just the file name without content', () => {
      expect(getToolSummary('Write', { file_path: '/a/x.ts' })).toBe('x.ts');
    });
  });

  describe('Bash', () => {
    it('prefers the description over the command', () => {
      expect(getToolSummary('Bash', { command: 'pnpm test', description: 'Run tests' })).toBe(
        'Run tests'
      );
    });

    it('uses the command when there is no description', () => {
      expect(getToolSummary('Bash', { command: 'pnpm test' })).toBe('pnpm test');
    });

    it('truncates long commands to 50 characters', () => {
      expect(getToolSummary('Bash', { command: 'x'.repeat(60) })).toBe('x'.repeat(50) + '...');
    });

    it('falls back to the tool name', () => {
      expect(getToolSummary('Bash', {})).toBe('Bash');
    });
  });

  describe('Grep', () => {
    it('falls back to the tool name without a pattern', () => {
      expect(getToolSummary('Grep', {})).toBe('Grep');
    });

    it('quotes the pattern', () => {
      expect(getToolSummary('Grep', { pattern: 'TODO' })).toBe('"TODO"');
    });

    it('shows the glob when provided', () => {
      expect(getToolSummary('Grep', { pattern: 'TODO', glob: '*.ts' })).toBe('"TODO" in *.ts');
    });

    it('prefers the glob over the path', () => {
      expect(getToolSummary('Grep', { pattern: 'TODO', glob: '*.ts', path: '/a/src' })).toBe(
        '"TODO" in *.ts'
      );
    });

    it('shows the base name of the path', () => {
      expect(getToolSummary('Grep', { pattern: 'TODO', path: '/a/src' })).toBe('"TODO" in src');
    });

    it('truncates long patterns to 30 characters', () => {
      expect(getToolSummary('Grep', { pattern: 'y'.repeat(40) })).toBe(`"${'y'.repeat(30)}..."`);
    });
  });

  describe('Glob', () => {
    it('falls back to the tool name without a pattern', () => {
      expect(getToolSummary('Glob', {})).toBe('Glob');
    });

    it('quotes the pattern', () => {
      expect(getToolSummary('Glob', { pattern: '**/*.ts' })).toBe('"**/*.ts"');
    });

    it('shows the base name of the search path', () => {
      expect(getToolSummary('Glob', { pattern: '**/*.ts', path: '/a/src' })).toBe(
        '"**/*.ts" in src'
      );
    });
  });

  describe('Task', () => {
    it('prefers the description', () => {
      expect(getToolSummary('Task', { description: 'Explore repo', prompt: 'long prompt' })).toBe(
        'Explore repo'
      );
    });

    it('prefixes the subagent type', () => {
      expect(getToolSummary('Task', { description: 'Explore repo', subagentType: 'Explore' })).toBe(
        'Explore - Explore repo'
      );
    });

    it('falls back to the prompt', () => {
      expect(getToolSummary('Task', { prompt: 'Investigate the bug' })).toBe(
        'Investigate the bug'
      );
    });

    it('truncates long descriptions to 40 characters', () => {
      expect(getToolSummary('Task', { description: 'z'.repeat(50) })).toBe('z'.repeat(40) + '...');
    });

    it('falls back to the subagent type alone', () => {
      expect(getToolSummary('Task', { subagentType: 'Plan' })).toBe('Plan');
    });

    it('falls back to the tool name', () => {
      expect(getToolSummary('Task', {})).toBe('Task');
    });
  });

  describe('LSP', () => {
    it('falls back to the tool name without an operation', () => {
      expect(getToolSummary('LSP', {})).toBe('LSP');
    });

    it('shows the operation alone', () => {
      expect(getToolSummary('LSP', { operation: 'diagnostics' })).toBe('diagnostics');
    });

    it('shows the operation with the file name', () => {
      expect(getToolSummary('LSP', { operation: 'hover', filePath: '/a/b/x.ts' })).toBe(
        'hover - x.ts'
      );
    });
  });

  describe('WebFetch', () => {
    it('shows the host and path of a valid URL', () => {
      expect(getToolSummary('WebFetch', { url: 'https://example.com/docs/page?q=1' })).toBe(
        'example.com/docs/page'
      );
    });

    it('falls back to the raw string for invalid URLs', () => {
      expect(getToolSummary('WebFetch', { url: 'not a url' })).toBe('not a url');
    });

    it('falls back to the tool name without a URL', () => {
      expect(getToolSummary('WebFetch', {})).toBe('WebFetch');
    });
  });

  describe('WebSearch', () => {
    it('quotes the query', () => {
      expect(getToolSummary('WebSearch', { query: 'vitest coverage' })).toBe('"vitest coverage"');
    });

    it('falls back to the tool name', () => {
      expect(getToolSummary('WebSearch', {})).toBe('WebSearch');
    });
  });

  describe('TodoWrite', () => {
    it('pluralizes the item count', () => {
      expect(getToolSummary('TodoWrite', { todos: [{}, {}] })).toBe('2 items');
    });

    it('uses the singular form for a single item', () => {
      expect(getToolSummary('TodoWrite', { todos: [{}] })).toBe('1 item');
    });

    it('reports zero items as plural', () => {
      expect(getToolSummary('TodoWrite', { todos: [] })).toBe('0 items');
    });

    it('falls back to the tool name when todos is not an array', () => {
      expect(getToolSummary('TodoWrite', { todos: 'nope' })).toBe('TodoWrite');
    });
  });

  describe('NotebookEdit', () => {
    it('shows the edit mode and file name', () => {
      expect(
        getToolSummary('NotebookEdit', { notebook_path: '/a/nb.ipynb', edit_mode: 'insert' })
      ).toBe('insert - nb.ipynb');
    });

    it('shows the file name alone', () => {
      expect(getToolSummary('NotebookEdit', { notebook_path: '/a/nb.ipynb' })).toBe('nb.ipynb');
    });

    it('falls back to the tool name', () => {
      expect(getToolSummary('NotebookEdit', {})).toBe('NotebookEdit');
    });
  });

  describe('team tools', () => {
    it('summarizes TeamCreate with a truncated description', () => {
      expect(getToolSummary('TeamCreate', { team_name: 'alpha', description: 'd'.repeat(40) })).toBe(
        `alpha - ${'d'.repeat(30)}...`
      );
    });

    it('summarizes TeamCreate without a description', () => {
      expect(getToolSummary('TeamCreate', { team_name: 'alpha' })).toBe('alpha');
    });

    it('falls back for TeamCreate without a team name', () => {
      expect(getToolSummary('TeamCreate', {})).toBe('Create team');
    });

    it('summarizes TaskCreate with the subject', () => {
      expect(getToolSummary('TaskCreate', { subject: 'Fix build' })).toBe('Fix build');
    });

    it('falls back for TaskCreate without a subject', () => {
      expect(getToolSummary('TaskCreate', {})).toBe('Create task');
    });

    it('summarizes TaskUpdate with id, status and owner', () => {
      expect(
        getToolSummary('TaskUpdate', { taskId: '3', status: 'in_progress', owner: 'bob' })
      ).toBe('#3 in_progress -> bob');
    });

    it('falls back for an empty TaskUpdate', () => {
      expect(getToolSummary('TaskUpdate', {})).toBe('Update task');
    });

    it('summarizes TaskList', () => {
      expect(getToolSummary('TaskList', {})).toBe('List tasks');
    });

    it('summarizes TaskGet with and without an id', () => {
      expect(getToolSummary('TaskGet', { taskId: '7' })).toBe('Get task #7');
      expect(getToolSummary('TaskGet', {})).toBe('Get task');
    });

    it('summarizes SendMessage shutdown requests and responses', () => {
      expect(
        getToolSummary('SendMessage', { type: 'shutdown_request', recipient: 'bob' })
      ).toBe('Shutdown bob');
      expect(getToolSummary('SendMessage', { type: 'shutdown_response' })).toBe(
        'Shutdown response'
      );
    });

    it('summarizes SendMessage broadcasts', () => {
      expect(getToolSummary('SendMessage', { type: 'broadcast', summary: 'all hands' })).toBe(
        'Broadcast: all hands'
      );
    });

    it('summarizes direct SendMessage calls', () => {
      expect(getToolSummary('SendMessage', { recipient: 'bob', summary: 'ping' })).toBe(
        'To bob: ping'
      );
    });

    it('falls back for an empty SendMessage', () => {
      expect(getToolSummary('SendMessage', {})).toBe('Send message');
    });

    it('summarizes TeamDelete', () => {
      expect(getToolSummary('TeamDelete', {})).toBe('Delete team');
    });
  });

  describe('unknown tools', () => {
    it('returns the tool name for empty input', () => {
      expect(getToolSummary('mcp__custom__thing', {})).toBe('mcp__custom__thing');
    });

    it('prefers well-known parameter names', () => {
      expect(getToolSummary('CustomTool', { other: 'x', name: 'widget' })).toBe('widget');
      expect(getToolSummary('CustomTool', { query: 'search me' })).toBe('search me');
    });

    it('falls back to the first string parameter, truncated at 40 chars', () => {
      expect(getToolSummary('CustomTool', { first: 'w'.repeat(50) })).toBe('w'.repeat(40) + '...');
    });

    it('returns the tool name when no parameter is a string', () => {
      expect(getToolSummary('CustomTool', { count: 3 })).toBe('CustomTool');
    });
  });
});
