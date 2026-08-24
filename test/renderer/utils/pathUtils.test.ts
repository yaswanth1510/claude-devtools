import { describe, expect, it } from 'vitest';

import {
  getBaseName,
  getFirstSegment,
  hasPathSeparator,
  getDirectory,
  getParentDirectory,
  isRelativePath,
  resolveFilePath,
  splitPathSegments,
} from '@renderer/utils/pathUtils';

describe('pathUtils', () => {
  describe('getBaseName', () => {
    it('extracts filename from Unix path', () => {
      expect(getBaseName('/Users/name/project/file.ts')).toBe('file.ts');
    });

    it('extracts filename from Windows path', () => {
      expect(getBaseName('C:\\Users\\name\\project\\file.ts')).toBe('file.ts');
    });

    it('extracts filename from mixed-separator path', () => {
      expect(getBaseName('C:\\Users/name\\project/file.ts')).toBe('file.ts');
    });

    it('returns bare filename as-is', () => {
      expect(getBaseName('file.ts')).toBe('file.ts');
    });

    it('returns empty for trailing separator', () => {
      expect(getBaseName('/path/to/dir/')).toBe('');
    });

    it('returns empty for empty string', () => {
      expect(getBaseName('')).toBe('');
    });
  });

  describe('getFirstSegment', () => {
    it('returns first segment from Unix path', () => {
      expect(getFirstSegment('src/components/App.tsx')).toBe('src');
    });

    it('returns first segment from Windows path', () => {
      expect(getFirstSegment('src\\components\\App.tsx')).toBe('src');
    });

    it('returns drive letter from Windows absolute path', () => {
      expect(getFirstSegment('C:\\Users\\name')).toBe('C:');
    });

    it('skips leading separator in absolute path', () => {
      expect(getFirstSegment('/Users/name')).toBe('Users');
    });

    it('returns bare filename', () => {
      expect(getFirstSegment('file.ts')).toBe('file.ts');
    });

    it('returns empty for empty string', () => {
      expect(getFirstSegment('')).toBe('');
    });
  });

  describe('splitPathSegments', () => {
    it('splits Unix path', () => {
      expect(splitPathSegments('/a/b/c')).toEqual(['a', 'b', 'c']);
    });

    it('splits Windows path', () => {
      expect(splitPathSegments('C:\\a\\b\\c')).toEqual(['C:', 'a', 'b', 'c']);
    });

    it('splits mixed-separator path', () => {
      expect(splitPathSegments('a/b\\c')).toEqual(['a', 'b', 'c']);
    });

    it('filters empty segments', () => {
      expect(splitPathSegments('//a///b//')).toEqual(['a', 'b']);
    });

    it('returns single segment for bare name', () => {
      expect(splitPathSegments('file.ts')).toEqual(['file.ts']);
    });
  });

  describe('hasPathSeparator', () => {
    it('detects forward slash', () => {
      expect(hasPathSeparator('a/b')).toBe(true);
    });

    it('detects backslash', () => {
      expect(hasPathSeparator('a\\b')).toBe(true);
    });

    it('returns false for bare name', () => {
      expect(hasPathSeparator('file.ts')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(hasPathSeparator('')).toBe(false);
    });
  });

  describe('isRelativePath', () => {
    it('detects ./ prefix', () => {
      expect(isRelativePath('./src')).toBe(true);
    });

    it('detects .\\ prefix', () => {
      expect(isRelativePath('.\\src')).toBe(true);
    });

    it('detects ../ prefix', () => {
      expect(isRelativePath('../lib')).toBe(true);
    });

    it('detects ..\\ prefix', () => {
      expect(isRelativePath('..\\lib')).toBe(true);
    });

    it('rejects absolute Unix path', () => {
      expect(isRelativePath('/abs')).toBe(false);
    });

    it('rejects absolute Windows path', () => {
      expect(isRelativePath('C:\\abs')).toBe(false);
    });

    it('rejects bare name', () => {
      expect(isRelativePath('name')).toBe(false);
    });

    it('rejects single dot without separator', () => {
      expect(isRelativePath('.hidden')).toBe(false);
    });
  });

  describe('getDirectory', () => {
    it('returns directory from Unix path', () => {
      expect(getDirectory('/a/b/file.ts')).toBe('/a/b');
    });

    it('returns directory from Windows path', () => {
      expect(getDirectory('C:\\a\\b\\file.ts')).toBe('C:\\a\\b');
    });

    it('returns directory from mixed-separator path', () => {
      expect(getDirectory('C:\\a/b\\file.ts')).toBe('C:\\a/b');
    });

    it('returns empty for bare filename', () => {
      expect(getDirectory('file.ts')).toBe('');
    });

    it('returns root for root-level file', () => {
      expect(getDirectory('/file.ts')).toBe('');
    });
  });

  describe('getParentDirectory', () => {
    it('returns parent from Unix path', () => {
      expect(getParentDirectory('/a/b/c')).toBe('/a/b');
    });

    it('returns parent from Windows path', () => {
      expect(getParentDirectory('C:\\a\\b\\c')).toBe('C:\\a\\b');
    });

    it('returns null at root', () => {
      expect(getParentDirectory('/a')).toBeNull();
    });

    it('returns null for single segment', () => {
      expect(getParentDirectory('a')).toBeNull();
    });

    it('returns parent from deeply nested path', () => {
      expect(getParentDirectory('/a/b/c/d/e')).toBe('/a/b/c/d');
    });
  });

  describe('resolveFilePath', () => {
    it('returns unix absolute paths as-is', () => {
      expect(resolveFilePath('/repo', '/repo/src/index.ts')).toBe('/repo/src/index.ts');
    });

    it('returns windows absolute paths as-is', () => {
      expect(resolveFilePath('C:\\repo', 'C:\\repo\\src\\index.ts')).toBe('C:\\repo\\src\\index.ts');
    });

    it('resolves dot-prefixed relative paths', () => {
      expect(resolveFilePath('/repo', './src/app.ts')).toBe('/repo/src/app.ts');
    });

    it('resolves parent relative paths on unix', () => {
      expect(resolveFilePath('/repo/apps/web', '../shared/file.ts')).toBe(
        '/repo/apps/shared/file.ts'
      );
    });

    it('resolves parent relative paths on windows', () => {
      expect(resolveFilePath('C:\\repo\\apps\\web', '..\\shared\\file.ts')).toBe(
        'C:\\repo\\apps\\shared\\file.ts'
      );
    });

    it('passes through tilde paths as-is', () => {
      expect(resolveFilePath('/repo', '~/some/directory')).toBe('~/some/directory');
    });

    it('passes through tilde paths with @ prefix as-is', () => {
      expect(resolveFilePath('/repo', '@~/some/file.ts')).toBe('~/some/file.ts');
    });

    it('passes through bare tilde as-is', () => {
      expect(resolveFilePath('/repo', '~')).toBe('~');
    });

    it('passes through tilde paths with backslash separator (Windows)', () => {
      expect(resolveFilePath('C:\\repo', '~\\.claude\\agents\\file.md')).toBe(
        '~\\.claude\\agents\\file.md'
      );
    });

    it('does not treat tilde in the middle as special', () => {
      expect(resolveFilePath('/repo', 'foo~/bar')).toBe('/repo/foo~/bar');
    });
  });
});
