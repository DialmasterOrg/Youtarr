import React from 'react';
import { Tooltip } from '../../ui';
import { Info as InfoIcon } from '../../../lib/icons';

interface InfoHintProps {
  label: string;
  children: React.ReactNode;
}

// stopPropagation keeps a hint placed next to a labelled control from
// toggling that control when tapped.
const InfoHint: React.FC<InfoHintProps> = ({ label, children }) => {
  return (
    <Tooltip title={children} placement="top">
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="inline-flex items-center justify-center w-4 h-4 align-middle rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <InfoIcon size={14} aria-hidden />
      </button>
    </Tooltip>
  );
};

export default InfoHint;
