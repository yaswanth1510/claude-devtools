/**
 * CopyablePath - Path display with copy-to-clipboard on hover.
 * Click anywhere on the path row to copy the full absolute path.
 * A small icon appears on hover as visual affordance.
 */

import React, { useCallback } from 'react';

import { useCopyToClipboard } from '@renderer/hooks/useCopyToClipboard';
import { Check, Copy } from 'lucide-react';

interface CopyablePathProps {
  /** Shortened path for display */
  displayText: string;
  /** Full absolute path for clipboard */
  copyText: string;
  /** CSS classes for the text span */
  className?: string;
  /** Inline style for the text span */
  style?: React.CSSProperties;
}

export const CopyablePath = ({
  displayText,
  copyText,
  className = '',
  style,
}: Readonly<CopyablePathProps>): React.ReactElement => {
  const { copied, copy } = useCopyToClipboard(1500);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      await copy(copyText);
    },
    [copy, copyText]
  );

  return (
    <div
      role="button"
      tabIndex={-1}
      className="group/copypath flex min-w-0 cursor-pointer items-center gap-1"
      title={copyText}
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') void handleCopy(e as unknown as React.MouseEvent);
      }}
    >
      <span className={`min-w-0 truncate ${className}`} style={style}>
        {displayText}
      </span>
      <span
        className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/copypath:opacity-60"
        style={{ color: style?.color ?? 'var(--color-text-muted)' }}
        aria-hidden="true"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </span>
    </div>
  );
};
