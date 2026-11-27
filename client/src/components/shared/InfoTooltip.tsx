import React from 'react';
import { Tooltip } from '../ui';
import { Info as InfoIcon } from '../../lib/icons';

interface InfoTooltipProps {
  text: React.ReactNode;
  // Names the button for assistive tech; give one when several sit close together.
  label?: string;
}

// An info icon whose text shows on hover or focus, and on tap on touch screens.
// stopPropagation keeps one placed next to a labelled control from toggling
// that control when tapped.
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, label = 'More information' }) => (
  <Tooltip title={text} arrow placement="top">
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="ml-1 inline-flex items-center rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <InfoIcon size={16} aria-hidden />
    </button>
  </Tooltip>
);
