import React, { useState } from 'react';
import { IconButton, Popover } from '../ui';
import { Info as InfoOutlinedIcon } from '../../lib/icons';

interface InfoPopoverButtonProps {
  ariaLabel: string;
  children: React.ReactNode;
  // Icon tint, e.g. to invite a click when something needs explaining.
  color?: string;
}

// Click-to-open explanation, so it works the same with a mouse and on touch
// screens, where hover tooltips never appear.
const InfoPopoverButton: React.FC<InfoPopoverButtonProps> = ({ ariaLabel, children, color }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={ariaLabel}
        className="p-1"
        style={color ? { color } : undefined}
      >
        <InfoOutlinedIcon size={16} />
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <div className="max-w-[320px] p-3 text-sm md:max-w-[480px]">{children}</div>
      </Popover>
    </>
  );
};

export default InfoPopoverButton;
