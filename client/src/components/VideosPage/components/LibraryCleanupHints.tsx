import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography } from '../../ui';
import type { ChipFilterMode } from '../../shared/VideoList';
import { REMOVED_VIDEOS_SETTINGS_PATH } from '../../../utils/videoRemoval';

interface LibraryCleanupHintsProps {
  missingFilter: ChipFilterMode;
  deletedFilter: ChipFilterMode;
  // Whether the current page lists any video, so a hint never sits over an empty list.
  hasVideos: boolean;
}

const INLINE_LINK_CLASS = 'h-auto p-0 align-baseline text-xs';

// Points the Videos page at Settings > Maintenance, where missing videos can be
// marked as deleted and deleted ones removed for good, under the Missing or
// Deleted filter when it shows only those videos.
function LibraryCleanupHints({ missingFilter, deletedFilter, hasVideos }: LibraryCleanupHintsProps) {
  const navigate = useNavigate();
  const maintenanceLink = (label: string) => (
    <Button variant="link" className={INLINE_LINK_CLASS} onClick={() => navigate(REMOVED_VIDEOS_SETTINGS_PATH)}>
      {label}
    </Button>
  );

  return (
    <>
      {hasVideos && missingFilter === 'only' && (
        <Typography variant="caption" color="text.secondary" component="p" align="center">
          If these files are really gone, select them and choose Mark as deleted, or{' '}
          {maintenanceLink('mark them all in Maintenance')}.
        </Typography>
      )}
      {hasVideos && deletedFilter === 'only' && (
        <Typography variant="caption" color="text.secondary" component="p" align="center">
          Deleted videos stay listed so they can be re-downloaded. To remove them for good,{' '}
          {maintenanceLink('empty the trash in Maintenance')}.
        </Typography>
      )}
    </>
  );
}

export default LibraryCleanupHints;
