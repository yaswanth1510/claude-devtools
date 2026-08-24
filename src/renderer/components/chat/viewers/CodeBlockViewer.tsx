import React, { useMemo } from 'react';

import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard';
import { inferLanguage } from '@renderer/utils/languageDetection';
import { getBaseName } from '@renderer/utils/pathUtils';
import { Check, Copy, FileCode } from 'lucide-react';

import { highlightLine } from './syntaxHighlighter';

// =============================================================================
// Types
// =============================================================================

interface CodeBlockViewerProps {
  fileName: string; // e.g., "src/components/Header.tsx"
  content: string; // The actual file content
  language?: string; // Inferred from file extension if not provided
  startLine?: number; // If partial read, starting line
  endLine?: number; // If partial read, ending line
  maxHeight?: string; // CSS max-height class (default: "max-h-96")
}

// =============================================================================
// Component
// =============================================================================

export const CodeBlockViewer: React.FC<CodeBlockViewerProps> = ({
  fileName,
  content,
  language,
  startLine = 1,
  endLine,
  maxHeight = 'max-h-96',
}): React.JSX.Element => {
  const { copied, copy } = useCopyToClipboard();

  // Infer language from file extension if not provided
  const detectedLanguage = language ?? inferLanguage(fileName);

  // Split content into lines
  const lines = useMemo(() => content.split('\n'), [content]);
  const totalLines = lines.length;

  // Calculate the actual line range for display
  const actualEndLine = endLine ?? startLine + totalLines - 1;

  const handleCopy = (): void => {
    void copy(content);
  };

  // Extract just the filename for display
  const displayFileName = getBaseName(fileName) || fileName;

  return (
    <div
      className="overflow-hidden rounded-lg shadow-sm"
      style={{
        backgroundColor: 'var(--code-bg)',
        border: '1px solid var(--code-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          backgroundColor: 'var(--code-header-bg)',
          borderBottom: '1px solid var(--code-border)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <FileCode className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          <span
            className="truncate font-mono text-sm"
            title={fileName}
            style={{ color: 'var(--code-filename)' }}
          >
            {displayFileName}
          </span>
          {(startLine > 1 || endLine) && (
            <span className="shrink-0 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              (lines {startLine}-{actualEndLine})
            </span>
          )}
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-xs"
            style={{
              backgroundColor: 'var(--tag-bg)',
              color: 'var(--tag-text)',
              border: '1px solid var(--tag-border)',
            }}
          >
            {detectedLanguage}
          </span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="rounded p-1 transition-colors hover:opacity-80"
          title="Copy to clipboard"
          style={{ backgroundColor: 'transparent' }}
        >
          {copied ? (
            <Check className="size-4" style={{ color: 'var(--badge-success-bg)' }} />
          ) : (
            <Copy className="size-4" style={{ color: 'var(--color-text-muted)' }} />
          )}
        </button>
      </div>

      {/* Code content */}
      <div className={`overflow-auto ${maxHeight}`}>
        <pre className="m-0 bg-transparent p-0">
          <code className="block font-mono text-xs leading-relaxed">
            {lines.map((line, index) => {
              const lineNumber = startLine + index;
              return (
                <div key={index} className="flex hover:bg-[var(--color-surface-overlay)]">
                  {/* Line number */}
                  <span
                    className="w-12 shrink-0 select-none px-3 py-0.5 text-right"
                    style={{
                      color: 'var(--code-line-number)',
                      borderRight: '1px solid var(--code-border)',
                    }}
                  >
                    {lineNumber}
                  </span>
                  {/* Code line */}
                  <span
                    className="flex-1 whitespace-pre px-4 py-0.5"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {highlightLine(line, detectedLanguage)}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
};
