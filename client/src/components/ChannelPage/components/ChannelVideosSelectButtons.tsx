import React from 'react';
import { Button } from '../../ui';

interface ChannelVideosSelectButtonsProps {
  canSelectPending: boolean;
  canSelectDownloaded: boolean;
  onSelectPending: () => void;
  onSelectDownloaded: () => void;
}

// Select every video on screen that can be downloaded, or every one that
// can be deleted.
function ChannelVideosSelectButtons({
  canSelectPending,
  canSelectDownloaded,
  onSelectPending,
  onSelectDownloaded,
}: ChannelVideosSelectButtonsProps) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button
        size="small"
        variant="outlined"
        onClick={onSelectPending}
        disabled={!canSelectPending}
        className="intent-warning"
      >
        Select pending
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={onSelectDownloaded}
        disabled={!canSelectDownloaded}
        className="intent-base"
      >
        Select downloaded
      </Button>
    </div>
  );
}

export default ChannelVideosSelectButtons;
