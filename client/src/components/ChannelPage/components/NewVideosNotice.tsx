import React from 'react';
import { createPortal } from 'react-dom';
import { Button, LinearProgress, Typography } from '../../ui';
import { Close as CloseIcon } from '../../../lib/icons';

// Just under the selection bar, which floats above everything else on the page.
const NOTICE_Z_INDEX = 1398;
const BOTTOM_GAP_PX = 16;
// Clears the selection bar that takes the bottom of a phone screen.
const BOTTOM_GAP_ABOVE_SELECTION_BAR_PX = 76;
const CHECKING_BAR_HEIGHT_PX = 2;

interface NewVideosNoticeProps {
  // A background refresh of the tab is running.
  checking: boolean;
  // Videos the last background refresh added that the list does not show yet.
  newCount: number;
  onShow: () => void;
  onDismiss: () => void;
  // Sit above a bar that occupies the bottom of the screen.
  raised?: boolean;
}

// A finished background refresh never changes the list on its own, because
// that would move rows under a selection or an open video. Its new videos
// are offered here and loaded only when the user asks.
//
// Neither state takes up layout space, so the list does not move when one
// appears or goes away. The offer floats on the screen rather than sitting
// in the list header, because that header scrolls away with the page and an
// infinite list would hide it.
const NewVideosNotice: React.FC<NewVideosNoticeProps> = ({ checking, newCount, onShow, onDismiss, raised = false }) => {
  if (newCount > 0) {
    if (typeof document === 'undefined') return null;
    const bottomGap = raised ? BOTTOM_GAP_ABOVE_SELECTION_BAR_PX : BOTTOM_GAP_PX;
    return createPortal(
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: `calc(var(--mobile-nav-total-offset, 0px) + ${bottomGap}px)`,
          zIndex: NOTICE_Z_INDEX,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 6px 6px 14px',
          borderRadius: 'var(--radius-ui)',
          border: 'var(--nav-border)',
          backgroundColor: 'var(--card)',
          boxShadow: 'var(--shadow-hard)',
          whiteSpace: 'nowrap',
        }}
      >
        <Typography variant="body2" style={{ fontWeight: 700 }}>
          {newCount === 1 ? '1 new video' : `${newCount.toLocaleString()} new videos`}
        </Typography>
        <Button onClick={onShow} variant="contained" size="small">
          Show
        </Button>
        <Button onClick={onDismiss} variant="text" size="icon-sm" color="inherit" aria-label="Dismiss">
          <CloseIcon size={16} />
        </Button>
      </div>,
      document.body
    );
  }

  if (checking) {
    // Pinned to the bottom edge of the list header (its positioned parent).
    return (
      <div role="status" className="absolute inset-x-0 bottom-0">
        <LinearProgress variant="indeterminate" height={CHECKING_BAR_HEIGHT_PX} aria-hidden="true" />
        <span className="sr-only">Checking for new videos</span>
      </div>
    );
  }

  return null;
};

export default NewVideosNotice;
