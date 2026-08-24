import React, { useState } from 'react';

import { createLogger } from '@shared/utils/logger';
import { Check, Copy, X } from 'lucide-react';

const logger = createLogger('Component:CopyButton');

interface CopyButtonProps {
  /** Text to copy to clipboard */
  text: string;
  /** Background color the gradient fades into (must match parent surface) */
  bgColor?: string;
  /** Render as inline element instead of absolute overlay */
  inline?: boolean;
}

/**
 * Copy-to-clipboard button with two modes:
 *
 * **Overlay** (default): Absolute-positioned in top-right corner, visible on
 * group hover. A horizontal gradient fades from transparent to `bgColor` so
 * text behind the button isn't abruptly covered.
 * Requires an ancestor with `group` and `relative` classes.
 *
 * **Inline** (`inline`): Normal-flow button for use inside headers/toolbars.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  bgColor = 'var(--code-bg)',
  inline = false,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      // The clipboard API may be unavailable or permission-denied; surface it
      // on the button instead of pretending the copy succeeded.
      logger.error('Clipboard write failed:', error);
      setHasFailed(true);
      setTimeout(() => setHasFailed(false), 2000);
    }
  };

  const title = hasFailed ? 'Copy failed' : 'Copy to clipboard';

  let icon = <Copy className="size-3.5" style={{ color: 'var(--color-text-muted)' }} />;
  if (isCopied) {
    icon = <Check className="size-3.5" style={{ color: 'var(--badge-success-bg)' }} />;
  } else if (hasFailed) {
    icon = <X className="size-3.5" style={{ color: 'var(--badge-error-bg)' }} />;
  }

  if (inline) {
    return (
      <button
        onClick={handleCopy}
        className="rounded p-1 transition-colors hover:opacity-80"
        title={title}
      >
        {icon}
      </button>
    );
  }

  return (
    <div className="pointer-events-none absolute right-0 top-0 z-10 flex opacity-0 transition-opacity group-hover:opacity-100">
      {/* Gradient fade from transparent to bgColor so text isn't obscured */}
      <div
        className="w-8 self-stretch"
        style={{ background: `linear-gradient(to right, transparent, ${bgColor})` }}
      />
      {/* Solid background holding the button */}
      <div className="rounded-bl-lg p-1.5" style={{ backgroundColor: bgColor }}>
        <button onClick={handleCopy} className="pointer-events-auto rounded p-1.5" title={title}>
          {icon}
        </button>
      </div>
    </div>
  );
};
