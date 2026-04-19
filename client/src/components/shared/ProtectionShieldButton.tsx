import React from 'react';
import { IconButton, Tooltip } from '../ui';
import { Shield as ShieldIcon, ShieldCheck as ShieldOutlinedIcon } from '../../lib/icons';

type ShieldVariant = 'overlay' | 'inline';
type ShieldSize = 'small' | 'medium';

interface ProtectionShieldButtonProps {
  isProtected: boolean;
  onClick: (e: React.MouseEvent) => void;
  variant?: ShieldVariant;
  size?: ShieldSize;
  style?: React.CSSProperties;
}

function ProtectionShieldButton({
  isProtected,
  onClick,
  variant = 'overlay',
  size = 'medium',
  style,
}: ProtectionShieldButtonProps) {
  const tooltipText = isProtected ? 'Remove protection' : 'Protect from auto-deletion';
  const iconSize = size === 'small' ? 14 : 16;

  const overlayClassName = isProtected
    ? 'bg-primary text-primary-foreground opacity-100 transition-all duration-200'
    : 'bg-black/50 text-white/60 opacity-60 hover:bg-black/80 hover:opacity-100 transition-all duration-200';

  const inlineClassName = isProtected
    ? 'text-primary'
    : 'text-foreground/50 hover:text-primary transition-colors duration-200';

  const buttonClassName = variant === 'overlay' ? overlayClassName : inlineClassName;

  return (
    <Tooltip title={tooltipText} arrow>
      <IconButton
        aria-label={tooltipText}
        onClick={onClick}
        size="small"
        className={buttonClassName}
        style={style}
      >
        {isProtected
          ? <ShieldIcon size={iconSize} />
          : <ShieldOutlinedIcon size={iconSize} />}
      </IconButton>
    </Tooltip>
  );
}

export default ProtectionShieldButton;
