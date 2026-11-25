import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlaylistMutations } from '../../../hooks/usePlaylistMutations';
import { PlaylistVideo } from '../../../types/playlist';
import { isListedInOutputs } from '../components/playlistVideoHelpers';
import { MAX_BATCH_SIZE } from '../playlistConstants';

interface UsePlaylistVideoIgnoreOptions {
  token: string | null;
  playlistId: string | null;
  videosById: Map<string, PlaylistVideo>;
  markVideosIgnored: (youtubeIds: string[], ignored: boolean) => void;
  refetchMeta: () => Promise<void>;
  notify: (message: string, severity?: 'success' | 'error') => void;
  onBulkIgnored: () => void;
}

const OUTPUTS_UPDATE = 'The .m3u file and any synced server playlists will update shortly';

function videoCount(count: number): string {
  return `${count} video${count === 1 ? '' : 's'}`;
}

function singleMessage(ignored: boolean, listed: boolean): string {
  if (ignored) {
    return listed
      ? `Ignored for this playlist. ${OUTPUTS_UPDATE}; no file is deleted.`
      : "Ignored for this playlist. It won't be downloaded with this playlist.";
  }
  return listed
    ? `No longer ignored. ${OUTPUTS_UPDATE}.`
    : 'No longer ignored. It can be downloaded with this playlist again.';
}

function bulkMessage(count: number, anyListed: boolean): string {
  // Another session ignored them first.
  if (count === 0) return 'Those videos were already ignored.';
  const ignored = `Ignored ${videoCount(count)}.`;
  if (anyListed) return `${ignored} ${OUTPUTS_UPDATE}; no file is deleted.`;
  return `${ignored} ${count === 1 ? 'It' : 'They'} won't be downloaded with this playlist.`;
}

/**
 * Ignore and unignore for playlist videos, one at a time or as a selection.
 * A selection is confirmed first when it includes videos the playlist's .m3u
 * file and synced server playlists list, since ignoring removes them from
 * both. Rows are updated in place, so a long (paginated) list keeps its
 * scroll position.
 */
export function usePlaylistVideoIgnore({
  token,
  playlistId,
  videosById,
  markVideosIgnored,
  refetchMeta,
  notify,
  onBulkIgnored,
}: UsePlaylistVideoIgnoreOptions) {
  const { ignoreVideo, unignoreVideo, ignoreVideos, runPendingRefresh } = usePlaylistMutations({ token });
  const [pendingVideoId, setPendingVideoId] = useState<string | null>(null);
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // The page is not remounted when it moves to another playlist, so a request
  // can finish after the playlist changed. Its result then belongs to a list
  // that is no longer shown, and is dropped.
  const shownPlaylistRef = useRef(playlistId);
  useEffect(() => {
    shownPlaylistRef.current = playlistId;
  }, [playlistId]);

  // The server rebuilds the playlist's outputs a little after the last ignore
  // change. Leaving the page ends the run of changes, so it starts then.
  const changedRef = useRef(false);
  useEffect(() => {
    if (!playlistId) return undefined;
    return () => {
      if (!changedRef.current) return;
      changedRef.current = false;
      void runPendingRefresh(playlistId);
    };
  }, [playlistId, runPendingRefresh]);

  const isListed = useCallback(
    (ytId: string) => {
      const video = videosById.get(ytId);
      return Boolean(video && isListedInOutputs(video));
    },
    [videosById]
  );

  const setIgnored = useCallback(
    async (ytId: string, ignored: boolean) => {
      if (!playlistId) return;
      setPendingVideoId(ytId);
      const ok = await (ignored ? ignoreVideo : unignoreVideo)(playlistId, ytId);
      setPendingVideoId(null);
      if (shownPlaylistRef.current !== playlistId) return;
      if (!ok) {
        notify(`Could not ${ignored ? 'ignore' : 'unignore'} the video. Please retry.`, 'error');
        return;
      }
      changedRef.current = true;
      markVideosIgnored([ytId], ignored);
      notify(singleMessage(ignored, isListed(ytId)));
      await refetchMeta();
    },
    [playlistId, ignoreVideo, unignoreVideo, markVideosIgnored, isListed, notify, refetchMeta]
  );

  const ignoreOne = useCallback((ytId: string) => setIgnored(ytId, true), [setIgnored]);
  const unignoreOne = useCallback((ytId: string) => setIgnored(ytId, false), [setIgnored]);

  const notIgnored = useCallback(
    (ids: string[]) =>
      ids.filter((id) => {
        const video = videosById.get(id);
        return Boolean(video && !video.ignored);
      }),
    [videosById]
  );

  const ignoreMany = useCallback(
    async (ids: string[]) => {
      if (!playlistId || ids.length === 0) return;
      setBulkLoading(true);
      // The server takes a limited number of ids per request.
      const sent: string[] = [];
      let newlyIgnored = 0;
      let failed = false;
      for (let start = 0; start < ids.length; start += MAX_BATCH_SIZE) {
        const batch = ids.slice(start, start + MAX_BATCH_SIZE);
        const count = await ignoreVideos(playlistId, batch);
        if (count === null) {
          failed = true;
          break;
        }
        sent.push(...batch);
        newlyIgnored += count;
      }
      setBulkLoading(false);
      if (shownPlaylistRef.current !== playlistId) return;

      if (sent.length > 0) {
        changedRef.current = true;
        markVideosIgnored(sent, true);
      }
      if (failed) {
        // The selection stays: a retry sends only the videos not ignored yet.
        notify(
          sent.length > 0
            ? `Ignored ${videoCount(newlyIgnored)}, then a request failed. Retry to ignore the rest.`
            : 'Could not ignore the selected videos. Please retry.',
          'error'
        );
      } else {
        notify(bulkMessage(newlyIgnored, sent.some(isListed)));
        onBulkIgnored();
      }
      if (sent.length > 0) await refetchMeta();
    },
    [playlistId, ignoreVideos, markVideosIgnored, isListed, notify, onBulkIgnored, refetchMeta]
  );

  const requestBulkIgnore = useCallback(
    (selectedIds: string[]) => {
      const ids = notIgnored(selectedIds);
      if (ids.length === 0) return;
      if (!ids.some(isListed)) {
        void ignoreMany(ids);
        return;
      }
      setConfirmIds(ids);
      setDialogOpen(true);
    },
    [notIgnored, isListed, ignoreMany]
  );

  const cancelBulkIgnore = useCallback(() => setDialogOpen(false), []);

  const confirmBulkIgnore = useCallback(() => {
    setDialogOpen(false);
    void ignoreMany(confirmIds);
  }, [ignoreMany, confirmIds]);

  const canBulkIgnore = useCallback(
    (ids: string[]) => !bulkLoading && notIgnored(ids).length > 0,
    [bulkLoading, notIgnored]
  );

  const confirmListedCount = useMemo(
    () => confirmIds.filter(isListed).length,
    [confirmIds, isListed]
  );

  return {
    pendingVideoId,
    ignoreOne,
    unignoreOne,
    canBulkIgnore,
    requestBulkIgnore,
    dialogOpen,
    confirmCount: confirmIds.length,
    confirmListedCount,
    cancelBulkIgnore,
    confirmBulkIgnore,
  };
}
