import React from 'react';
import { Tooltip } from '../../ui';
import { Info as InfoIcon } from '../../../lib/icons';
import useMediaQuery from '../../../hooks/useMediaQuery';

interface InfoTooltipProps {
  text: string;
  onMobileClick?: (text: string) => void;
}

/**
 * Reusable info icon tooltip component
 * - Desktop: Shows tooltip on hover
 * - Mobile: Triggers callback to show snackbar
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, onMobileClick }) => {
  const isMobile = useMediaQuery('(max-width: 599px)');

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile && onMobileClick) {
      onMobileClick(text);
    }
  };

  if (isMobile) {
    return (
      <button
        aria-label="More information"
        style={{ marginLeft: 4, padding: 4, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--muted-foreground)' }}
        onClick={handleClick}
      >
        <InfoIcon size={16} />
      </button>
    );
  }

  return (
    <Tooltip title={text} arrow placement="top">
      <button
        aria-label="More information"
        style={{ marginLeft: 4, padding: 4, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--muted-foreground)' }}
      >
        <InfoIcon size={16} />
      </button>
    </Tooltip>
  );
};
