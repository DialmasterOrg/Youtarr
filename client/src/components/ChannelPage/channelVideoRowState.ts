import { ChannelVideo } from '../../types/ChannelVideo';
import { getVideoStatus, isRemovedStatus } from '../../utils/videoStatus';
import type { ChannelSelectionMode } from './hooks/useChannelVideoSelection';

type SelectionChange = (videoId: string, isChecked: boolean) => void;

// A stream that has not ended has no finished video to fetch or file to delete.
// The same two values the server's download-all and listing treat as live.
export const isStillLive = (video: ChannelVideo): boolean =>
  video.live_status === 'is_live' || video.live_status === 'is_upcoming';

// The rows, select-all and the table header share these two rules, so a
// selection never holds a video that no row lets the user uncheck.
export const canSelectForDownload = (video: ChannelVideo): boolean => {
  const status = getVideoStatus(video);
  const hasNoFile = status === 'never_downloaded' || isRemovedStatus(status) || status === 'ignored';
  return hasNoFile && !video.youtube_removed && !isStillLive(video);
};

export const canSelectForDelete = (video: ChannelVideo): boolean =>
  Boolean(video.added && !video.removed) && !isStillLive(video);

export function getChannelVideoRowState(
  video: ChannelVideo,
  selectionMode: ChannelSelectionMode,
  checkedBoxes: string[],
  selectedForDeletion: string[]
) {
  const deleteSelectable = canSelectForDelete(video);
  const isDeleteChecked = selectedForDeletion.includes(video.youtube_id);
  return {
    status: getVideoStatus(video),
    isStillLive: isStillLive(video),
    // The row offers this kind of selection in the page's current mode.
    canDownload: selectionMode !== 'delete' && canSelectForDownload(video),
    canDelete: selectionMode !== 'download' && deleteSelectable,
    isChecked: checkedBoxes.includes(video.youtube_id),
    isDeleteChecked,
    // Picked for deletion earlier; only marked while the page selects downloads.
    isDeleteHeld: selectionMode === 'download' && deleteSelectable && isDeleteChecked,
  };
}

export type ChannelVideoRowState = ReturnType<typeof getChannelVideoRowState>;

// What a click anywhere on the row does.
export function toggleRowSelection(
  video: ChannelVideo,
  row: ChannelVideoRowState,
  onCheckChange: SelectionChange,
  onDeletionChange: SelectionChange
): void {
  if (row.canDownload) onCheckChange(video.youtube_id, !row.isChecked);
  else if (row.canDelete) onDeletionChange(video.youtube_id, !row.isDeleteChecked);
}
