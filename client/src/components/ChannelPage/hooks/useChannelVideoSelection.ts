import { useState, useEffect, useCallback, useRef } from 'react';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { getVideoStatus, isRemovedStatus } from '../../../utils/videoStatus';
import { useVideoActivity } from '../../../providers/VideoActivityProvider';
import {
  useVideoSelection,
  type SelectionAction,
  type VideoSelectionState,
} from '../../shared/VideoList';

export type ChannelSelectionMode = 'download' | 'delete' | null;

interface UseChannelVideoSelectionParams {
  // The rows on screen, with their download activity.
  videos: ChannelVideo[];
  // The selection is dropped whenever either of these changes.
  filters: unknown;
  search: string;
}

export interface ChannelVideoSelection {
  checkedBoxes: string[];
  selectedForDeletion: string[];
  // Videos are selected either to download or to delete, never both: the
  // first selection sets the mode and the rows disable the other kind.
  selectionMode: ChannelSelectionMode;
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onDeletionChange: (videoId: string, isChecked: boolean) => void;
  // Adds every row on screen that fits the current mode.
  selectAll: () => void;
  selectAllNotDownloaded: () => void;
  selectAllDownloaded: () => void;
  canSelectNotDownloaded: boolean;
  canSelectDownloaded: boolean;
  clearAll: () => void;
  clearChecked: () => void;
  clearDeletion: () => void;
  removeFromDeletion: (videoIds: Array<string | number>) => void;
  // Selected videos that were downloaded before, so downloading them again
  // needs re-downloading allowed.
  missingVideoCount: number;
}

const canDownload = (video: ChannelVideo): boolean => {
  const status = getVideoStatus(video);
  return status === 'never_downloaded' || isRemovedStatus(status) || status === 'ignored';
};

const canDelete = (video: ChannelVideo): boolean => Boolean(video.added && !video.removed);

const withAdded = (videoIds: string[]) => (previous: string[]): string[] => [
  ...previous,
  ...videoIds.filter((id) => !previous.includes(id)),
];

const withToggled = (videoId: string, isChecked: boolean) => (previous: string[]): string[] =>
  isChecked ? [...previous, videoId] : previous.filter((id) => id !== videoId);

export function useChannelVideoSelection({
  videos,
  filters,
  search,
}: UseChannelVideoSelectionParams): ChannelVideoSelection {
  const { snapshot } = useVideoActivity();
  const [checkedBoxes, setCheckedBoxes] = useState<string[]>([]);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);

  const selectionMode: ChannelSelectionMode =
    checkedBoxes.length > 0 ? 'download' : selectedForDeletion.length > 0 ? 'delete' : null;

  // A video that is queued or downloading cannot be queued again.
  useEffect(() => {
    setCheckedBoxes((previous) => {
      const eligible = previous.filter((id) => !snapshot.videos[id]?.state);
      return eligible.length === previous.length ? previous : eligible;
    });
  }, [snapshot]);

  const onCheckChange = useCallback((videoId: string, isChecked: boolean) => {
    setCheckedBoxes(withToggled(videoId, isChecked));
  }, []);

  const onDeletionChange = useCallback((videoId: string, isChecked: boolean) => {
    setSelectedForDeletion(withToggled(videoId, isChecked));
  }, []);

  const clearChecked = useCallback(() => setCheckedBoxes([]), []);
  const clearDeletion = useCallback(() => setSelectedForDeletion([]), []);

  const clearAll = useCallback(() => {
    setCheckedBoxes([]);
    setSelectedForDeletion([]);
  }, []);

  const removeFromDeletion = useCallback((videoIds: Array<string | number>) => {
    setSelectedForDeletion((previous) => previous.filter((id) => !videoIds.includes(id)));
  }, []);

  // Clear the selection when a filter changes so bulk actions can't fire on
  // videos that are no longer in the filtered list. Sort and pagination are
  // deliberately excluded: they do not remove videos from the selection's
  // eligible set. A tab change clears it from the tab handler.
  useEffect(() => {
    clearAll();
  }, [filters, search, clearAll]);

  const selectAllNotDownloaded = useCallback(() => {
    setCheckedBoxes(withAdded(videos.filter(canDownload).map((video) => video.youtube_id)));
  }, [videos]);

  const selectAllDownloaded = useCallback(() => {
    setSelectedForDeletion(withAdded(videos.filter(canDelete).map((video) => video.youtube_id)));
  }, [videos]);

  // Accumulates missing status for every video seen on any loaded page, so
  // selections survive page swaps. Checkboxes only exist on loaded rows, so
  // lookups always hit. A video listed in the download archive without a
  // database record counts too: yt-dlp skips it unless re-download is allowed.
  const missingByIdRef = useRef(new Map<string, boolean>());
  useEffect(() => {
    videos.forEach((video) => {
      missingByIdRef.current.set(
        video.youtube_id,
        Boolean(video.added ? video.removed : video.inArchive)
      );
    });
  }, [videos]);

  const missingVideoCount = checkedBoxes.reduce(
    (count, videoId) => (missingByIdRef.current.get(videoId) ? count + 1 : count),
    0
  );

  return {
    checkedBoxes,
    selectedForDeletion,
    selectionMode,
    onCheckChange,
    onDeletionChange,
    selectAll: selectionMode === 'delete' ? selectAllDownloaded : selectAllNotDownloaded,
    selectAllNotDownloaded,
    selectAllDownloaded,
    canSelectNotDownloaded: videos.some(canDownload),
    canSelectDownloaded: videos.some(canDelete),
    clearAll,
    clearChecked,
    clearDeletion,
    removeFromDeletion,
    missingVideoCount,
  };
}

// The floating selection pill reads a VideoSelectionState. This mirrors the
// selection for the active mode into one, with that mode's actions; the pill's
// own Clear empties both kinds of selection.
export function useChannelSelectionPill(
  selection: ChannelVideoSelection,
  downloadActions: SelectionAction<string>[],
  deleteActions: SelectionAction<string>[]
): VideoSelectionState<string> | undefined {
  const { checkedBoxes, selectedForDeletion, selectionMode, clearAll } = selection;
  const downloadPill = useVideoSelection<string>({ actions: downloadActions });
  const deletePill = useVideoSelection<string>({ actions: deleteActions });
  const { set: setDownloadPill } = downloadPill;
  const { set: setDeletePill } = deletePill;

  useEffect(() => {
    setDownloadPill(checkedBoxes);
  }, [checkedBoxes, setDownloadPill]);

  useEffect(() => {
    setDeletePill(selectedForDeletion);
  }, [selectedForDeletion, setDeletePill]);

  if (selectionMode === null) return undefined;
  const activePill = selectionMode === 'download' ? downloadPill : deletePill;
  return {
    ...activePill,
    clear: () => {
      clearAll();
      activePill.clear();
    },
  };
}
