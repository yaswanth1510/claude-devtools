/**
 * Cross-platform path utilities for the renderer process.
 *
 * The renderer has no access to Node's `path` module, and session data
 * may originate from any OS, so all helpers handle both `/` and `\`.
 */

const SEP_RE = /[\\/]/;

/**
 * Returns the last segment of a path (the file or directory name).
 * Equivalent to `path.basename()` but handles both separators.
 */
export function getBaseName(filePath: string): string {
  const parts = filePath.split(SEP_RE);
  return parts[parts.length - 1] || '';
}

/**
 * Returns the first meaningful segment of a path.
 * Leading empty segments (from absolute paths like `/foo`) are skipped.
 */
export function getFirstSegment(filePath: string): string {
  const parts = filePath.split(SEP_RE).filter(Boolean);
  return parts[0] ?? '';
}

/**
 * Splits a path into non-empty segments.
 */
export function splitPathSegments(filePath: string): string[] {
  return filePath.split(SEP_RE).filter(Boolean);
}

/**
 * Returns true if the string contains a path separator (`/` or `\`).
 */
export function hasPathSeparator(filePath: string): boolean {
  return SEP_RE.test(filePath);
}

/**
 * Returns true if the path starts with `./`, `.\`, `../`, or `..\`.
 */
export function isRelativePath(filePath: string): boolean {
  return /^\.\.?[\\/]/.test(filePath);
}

/**
 * Returns true for POSIX roots (`/`), UNC roots (`\\`) and Windows drive paths.
 */
export function isAbsolutePath(filePath: string): boolean {
  return (
    filePath.startsWith('/') || filePath.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(filePath)
  );
}

/**
 * Returns true for home-relative paths (`~`, `~/…`, `~\…`).
 */
function isHomeRelativePath(filePath: string): boolean {
  return filePath === '~' || filePath.startsWith('~/') || filePath.startsWith('~\\');
}

/**
 * Resolves a relative path against a base path, handling various path formats:
 * - Absolute paths: /full/path/file.tsx (returned as-is)
 * - Home-relative paths: ~/file.tsx (returned as-is; expanded by the main process)
 * - Relative paths with ./: ./apps/foo/bar.tsx (strips ./)
 * - Parent paths with ../: ../other/file.tsx (walks up directories)
 * - Plain paths: apps/foo/bar.tsx (joins with base)
 * - Paths with @ prefix: @apps/foo/bar.tsx (strips @ then joins)
 */
export function resolveFilePath(base: string, relativePath: string): string {
  if (isAbsolutePath(relativePath)) {
    return relativePath;
  }

  const cleanBase = trimTrailingSeparator(base);

  // Handle @ prefix (file mention marker) - strip it if present
  let cleanRelative = relativePath;
  if (cleanRelative.startsWith('@')) {
    cleanRelative = cleanRelative.slice(1);
  }

  if (isHomeRelativePath(cleanRelative)) {
    return cleanRelative;
  }

  // Handle ./ prefix (current directory)
  if (cleanRelative.startsWith('./')) {
    cleanRelative = cleanRelative.slice(2);
  }

  // Handle ../ prefixes (parent directory)
  const separator = cleanBase.includes('\\') ? '\\' : '/';
  const hasUnixRoot = cleanBase.startsWith('/');
  const hasUncRoot = cleanBase.startsWith('\\\\');
  const baseParts = splitPathSegments(cleanBase);
  let remainingRelative = normalizeSeparators(cleanRelative, separator);

  while (remainingRelative.startsWith(`..${separator}`)) {
    remainingRelative = remainingRelative.slice(3);
    if (baseParts.length > 1) {
      baseParts.pop();
    }
  }

  let normalizedBase = baseParts.join(separator);
  if (hasUnixRoot && !normalizedBase.startsWith('/')) {
    normalizedBase = `/${normalizedBase}`;
  }
  if (hasUncRoot && !normalizedBase.startsWith('\\\\')) {
    normalizedBase = `\\\\${normalizedBase}`;
  }
  return remainingRelative ? `${normalizedBase}${separator}${remainingRelative}` : normalizedBase;
}

/**
 * Returns the directory containing a file, or `''` when there is no directory part.
 */
export function getDirectory(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastSep === -1) return '';
  return filePath.slice(0, lastSep);
}

/**
 * Returns the parent of a directory, or `null` at the root.
 */
export function getParentDirectory(dirPath: string): string | null {
  const lastSep = Math.max(dirPath.lastIndexOf('/'), dirPath.lastIndexOf('\\'));
  if (lastSep <= 0) return null; // At root or invalid
  return dirPath.slice(0, lastSep);
}

function trimTrailingSeparator(input: string): string {
  let end = input.length;
  while (end > 0 && SEP_RE.test(input[end - 1])) {
    end--;
  }
  return input.slice(0, end);
}

/**
 * Rewrites every run of separators to a single `separator`.
 */
function normalizeSeparators(input: string, separator: '/' | '\\'): string {
  return input.replace(/[\\/]+/g, separator);
}
