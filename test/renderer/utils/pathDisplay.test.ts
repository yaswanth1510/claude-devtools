import { describe, expect, it } from 'vitest';

import { resolveAbsolutePath, shortenDisplayPath } from '@renderer/utils/pathDisplay';

describe('shortenDisplayPath', () => {
  it('strips the project root to produce a relative path', () => {
    expect(
      shortenDisplayPath('/Users/name/project/.claude/rules/tailwind.md', '/Users/name/project')
    ).toBe('.claude/rules/tailwind.md');
  });

  it('strips a project root with a trailing separator', () => {
    expect(shortenDisplayPath('/Users/name/project/src/a.ts', '/Users/name/project/')).toBe(
      'src/a.ts'
    );
  });

  it('strips a Windows project root', () => {
    expect(shortenDisplayPath('C:\\Users\\name\\proj\\src\\a.ts', 'C:\\Users\\name\\proj')).toBe(
      'src\\a.ts'
    );
  });

  it('ignores a project root that does not prefix the path', () => {
    expect(shortenDisplayPath('/var/log/app.log', '/Users/name/project')).toBe('/var/log/app.log');
  });

  it('replaces a macOS home directory with ~', () => {
    expect(shortenDisplayPath('/Users/name/.claude/CLAUDE.md')).toBe('~/.claude/CLAUDE.md');
  });

  it('replaces a Linux home directory with ~', () => {
    expect(shortenDisplayPath('/home/name/.claude/CLAUDE.md')).toBe('~/.claude/CLAUDE.md');
  });

  it('replaces a Windows home directory with ~', () => {
    expect(shortenDisplayPath('C:\\Users\\name\\notes.md')).toBe('~\\notes.md');
  });

  it('middle-truncates long paths keeping head and last two segments', () => {
    expect(
      shortenDisplayPath('/Users/name/.claude/projects/-Users-name-project/memory/MEMORY.md')
    ).toBe('~/.claude/…/memory/MEMORY.md');
  });

  it('middle-truncates long relative paths', () => {
    const long = 'src/renderer/components/chat/items/linkedTool/BashToolViewer.tsx';
    expect(shortenDisplayPath(long)).toBe('src/…/linkedTool/BashToolViewer.tsx');
  });

  it('middle-truncates long Windows paths with backslashes', () => {
    const long = 'C:\\Users\\name\\some\\deeply\\nested\\folder\\structure\\file.ts';
    expect(shortenDisplayPath(long)).toBe('~\\some\\…\\structure\\file.ts');
  });

  it('leaves long paths untouched when there are too few segments to truncate', () => {
    const long = `/Users/name/${'a'.repeat(60)}`;
    expect(shortenDisplayPath(long)).toBe(`~/${'a'.repeat(60)}`);
  });

  it('honors a custom maxLength', () => {
    expect(shortenDisplayPath('src/renderer/utils/pathDisplay.ts', undefined, 10)).toBe(
      'src/…/utils/pathDisplay.ts'
    );
  });
});

describe('resolveAbsolutePath', () => {
  it('expands ~ using the home directory inferred from a macOS project root', () => {
    expect(resolveAbsolutePath('~/.claude/CLAUDE.md', '/Users/name/project')).toBe(
      '/Users/name/.claude/CLAUDE.md'
    );
  });

  it('expands ~ using the home directory inferred from a Linux project root', () => {
    expect(resolveAbsolutePath('~/.claude/CLAUDE.md', '/home/name/project')).toBe(
      '/home/name/.claude/CLAUDE.md'
    );
  });

  it('expands ~ using the home directory inferred from a Windows project root', () => {
    expect(resolveAbsolutePath('~/notes.md', 'C:\\Users\\name\\project')).toBe(
      'C:\\Users\\name/notes.md'
    );
  });

  it('leaves ~ untouched when no project root is given', () => {
    expect(resolveAbsolutePath('~/.claude/CLAUDE.md')).toBe('~/.claude/CLAUDE.md');
  });

  it('leaves ~ untouched when the home directory cannot be inferred', () => {
    expect(resolveAbsolutePath('~/.claude/CLAUDE.md', '/opt/work/project')).toBe(
      '~/.claude/CLAUDE.md'
    );
  });

  it('prepends the project root to relative paths', () => {
    expect(resolveAbsolutePath('src/foo/bar.ts', '/Users/name/project')).toBe(
      '/Users/name/project/src/foo/bar.ts'
    );
  });

  it('normalizes a trailing separator on the project root', () => {
    expect(resolveAbsolutePath('src/a.ts', '/Users/name/project/')).toBe(
      '/Users/name/project/src/a.ts'
    );
  });

  it('returns absolute POSIX paths unchanged', () => {
    expect(resolveAbsolutePath('/var/log/app.log', '/Users/name/project')).toBe('/var/log/app.log');
  });

  it('returns absolute Windows paths unchanged', () => {
    expect(resolveAbsolutePath('C:\\tmp\\a.ts', 'C:\\Users\\name\\project')).toBe('C:\\tmp\\a.ts');
  });

  it('returns relative paths unchanged when no project root is given', () => {
    expect(resolveAbsolutePath('src/a.ts')).toBe('src/a.ts');
  });
});
