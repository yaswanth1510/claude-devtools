/**
 * useCopyToClipboard - Copy text to the clipboard and expose a transient
 * "copied" flag that resets itself after `resetDelayMs`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCopyToClipboardResult {
  /** True for `resetDelayMs` after a successful copy */
  copied: boolean;
  /** Copies the given text; resolves to false when the clipboard is unavailable */
  copy: (text: string) => Promise<boolean>;
}

export function useCopyToClipboard(resetDelayMs = 2000): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard API may be unavailable in some contexts
        return false;
      }

      setCopied(true);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), resetDelayMs);
      return true;
    },
    [resetDelayMs]
  );

  return { copied, copy };
}
