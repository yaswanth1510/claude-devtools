/**
 * MentionedFileItem - Single mentioned file item display.
 */

import React from 'react';

import { CopyablePath } from '@renderer/components/common/CopyablePath';
import { resolveAbsolutePath, shortenDisplayPath } from '@renderer/utils/pathDisplay';
import { File } from 'lucide-react';

import { TurnLink } from '../components/TurnLink';
import { formatTokens } from '../utils/formatting';

import type { MentionedFileInjection } from '@renderer/types/contextInjection';

interface MentionedFileItemProps {
  injection: MentionedFileInjection;
  projectRoot?: string;
  onNavigateToTurn?: (turnIndex: number) => void;
}

export const MentionedFileItem = ({
  injection,
  projectRoot,
  onNavigateToTurn,
}: Readonly<MentionedFileItemProps>): React.ReactElement => {
  const turnIndex = injection.firstSeenTurnIndex;
  const displayPath = shortenDisplayPath(injection.path, projectRoot);
  const absolutePath = resolveAbsolutePath(injection.path, projectRoot);

  return (
    <div className="rounded px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <File size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        <CopyablePath
          displayText={displayPath}
          copyText={absolutePath}
          className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        />
        {!injection.exists && (
          <span
            className="rounded px-1 py-0.5 text-xs"
            style={{
              backgroundColor: 'var(--color-error-subtle)',
              color: 'var(--color-error)',
            }}
          >
            missing
          </span>
        )}
      </div>
      <div className="ml-4 mt-0.5 flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          ~{formatTokens(injection.estimatedTokens)} tokens
        </span>
        <TurnLink
          turnIndex={turnIndex}
          onNavigateToTurn={onNavigateToTurn}
          fallbackStyle={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
        />
      </div>
    </div>
  );
};
