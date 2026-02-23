import React, { useState } from 'react';
import { Tooltip, Chip } from '../ui';
import { Circle } from 'lucide-react';

interface StillLiveDotProps {
  isMobile?: boolean;
  onMobileClick?: (message: string) => void;
}

function StillLiveDot({ isMobile = false, onMobileClick }: StillLiveDotProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const message = "Cannot download while still airing";
  const tooltipTimeoutRef = React.useRef<number | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isMobile && onMobileClick) {
      onMobileClick(message);
    } else {
      setTooltipOpen(!tooltipOpen);
      // Auto-close tooltip after 2 seconds and store timeout id so we can clear it
      tooltipTimeoutRef.current = window.setTimeout(() => setTooltipOpen(false), 2000);
    }
  };

  React.useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const liveDot = (
    <Chip
      icon={<Circle size={12} data-testid="FiberManualRecordIcon" style={{ animationName: 'pulse', animationDuration: '2s', animationIterationCount: 'infinite' }} />}
      label="LIVE"
      size="small"
      onClick={handleClick}
      style={{
        backgroundColor: 'var(--destructive)',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer',
      }}
    />
  );

  if (isMobile) {
    return liveDot;
  }

  return (
    <Tooltip
      title={message}
      open={tooltipOpen}
      onClose={() => setTooltipOpen(false)}
      disableHoverListener
      disableFocusListener
      disableTouchListener
    >
      {liveDot}
    </Tooltip>
  );
}

export default StillLiveDot;
