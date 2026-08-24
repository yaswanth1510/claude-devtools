/**
 * TurnLink - `@Turn N` label shown by context panel items.
 * Renders as a dotted-underline link when navigation is available,
 * otherwise as plain text.
 */

import React from 'react';

import { COLOR_TEXT_SECONDARY } from '@renderer/constants/cssVariables';

interface TurnLinkProps {
  /** Zero-based turn index; rendered as `@Turn {turnIndex + 1}` */
  turnIndex: number;
  onNavigateToTurn?: (turnIndex: number) => void;
  /** Style for the non-clickable variant */
  fallbackStyle?: React.CSSProperties;
}

export const TurnLink = ({
  turnIndex,
  onNavigateToTurn,
  fallbackStyle,
}: Readonly<TurnLinkProps>): React.ReactElement => {
  const label = `@Turn ${turnIndex + 1}`;

  if (!onNavigateToTurn || turnIndex < 0) {
    return (
      <span className="text-xs" style={fallbackStyle ?? { color: COLOR_TEXT_SECONDARY }}>
        {label}
      </span>
    );
  }

  const navigate = (event: React.SyntheticEvent): void => {
    event.stopPropagation();
    onNavigateToTurn(turnIndex);
  };

  return (
    <span
      role="link"
      tabIndex={0}
      className="cursor-pointer text-xs transition-opacity hover:opacity-80"
      style={{
        color: '#93c5fd',
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textUnderlineOffset: '2px',
      }}
      onClick={navigate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(e);
      }}
    >
      {label}
    </span>
  );
};
