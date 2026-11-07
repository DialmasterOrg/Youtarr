import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography } from '../../ui';
import InfoHint from '../../shared/InfoHint';
import { REMOVED_VIDEOS_SETTINGS_PATH } from '../../../utils/videoRemoval';

interface HiddenDeletedNoteProps {
  // Deleted videos the current filters hide; null when deleted videos are not hidden.
  hiddenDeletedCount: number | null;
  onShowDeleted: () => void;
}

// "N deleted videos hidden." with Show, Clean up (Settings > Maintenance) and
// an explanation. Sits beside the Library heading on wide screens and under it
// on phones, so it annotates the total without taking a line of its own.
function HiddenDeletedNote({ hiddenDeletedCount, onShowDeleted }: HiddenDeletedNoteProps) {
  const navigate = useNavigate();
  if (hiddenDeletedCount === null || hiddenDeletedCount <= 0) return null;

  return (
    <Typography variant="caption" color="text.secondary" component="p" className="flex flex-wrap items-center justify-center gap-1">
      <span>{hiddenDeletedCount} deleted {hiddenDeletedCount === 1 ? 'video' : 'videos'} hidden.</span>
      <Button variant="text" size="sm" onClick={onShowDeleted}>Show</Button>
      <span aria-hidden="true">·</span>
      <Button variant="text" size="sm" onClick={() => navigate(REMOVED_VIDEOS_SETTINGS_PATH)}>Clean up</Button>
      <InfoHint label="About deleted videos">
        Deleted videos stay in your library so they can be re-downloaded. In Settings &gt; Maintenance you can
        mark missing videos as deleted, or empty the trash to remove deleted videos for good.
      </InfoHint>
    </Typography>
  );
}

export default HiddenDeletedNote;
