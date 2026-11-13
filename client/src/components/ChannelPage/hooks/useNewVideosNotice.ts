import { useState, useEffect, useCallback, useRef, MutableRefObject } from 'react';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { FetchCompletion } from './useChannelFetchStatus';

interface UseNewVideosNoticeParams {
  channelId: string | undefined;
  selectedTab: string | null;
  // From useChannelVideos: set while the server is listing this tab in the
  // background, and different for every response that reports it.
  refreshSeq: number | null;
  // Changes whenever the list restarts from its first page.
  resetKey: string;
  videos: ChannelVideo[];
  page: number;
  setPage: (page: number) => void;
  refetchVideos: () => Promise<void>;
  trackRefresh: () => void;
  onFetchComplete: (callback: (completion: FetchCompletion) => void) => void;
  onVideosLoaded?: (channelId: string) => void;
}

interface UseNewVideosNoticeResult {
  // A background refresh of this view is being followed.
  checking: boolean;
  // New videos the last refresh found and the list does not show yet.
  newCount: number;
  show: () => void;
  dismiss: () => void;
  // Goes on an element at the top of the list, so Show can scroll back to it.
  listTopRef: MutableRefObject<HTMLDivElement | null>;
}

// Follows a background refresh of the channel tab on screen and offers the
// videos it found. The list never reloads on its own: a reload moves rows
// under a selection and cannot update an infinite list past its first page.
export function useNewVideosNotice({
  channelId,
  selectedTab,
  refreshSeq,
  resetKey,
  videos,
  page,
  setPage,
  refetchVideos,
  trackRefresh,
  onFetchComplete,
  onVideosLoaded,
}: UseNewVideosNoticeParams): UseNewVideosNoticeResult {
  // Each names the channel and tab it belongs to, so neither shows on another view.
  const viewKey = channelId && selectedTab ? `${channelId}:${selectedTab}` : null;
  const [checkingViewKey, setCheckingViewKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ key: string; count: number } | null>(null);
  const listTopRef = useRef<HTMLDivElement | null>(null);
  const usedResultRef = useRef<string | null>(null);

  useEffect(() => {
    setCheckingViewKey(null);
  }, [viewKey]);

  // Any change that reloads the first page already shows what the notice offers.
  useEffect(() => {
    setNotice(null);
  }, [resetKey]);

  // So does any other reload of the first page (a download broadcast, a
  // delete, a rating change): the videos hook hands back a new list each time.
  useEffect(() => {
    if (page === 1) setNotice(null);
  }, [videos, page]);

  // The server answered from its stored rows and is listing the tab in the
  // background: follow that listing instead of waiting for it. Keyed on the
  // response, not on a flag, so a later refresh of the same view is followed too.
  useEffect(() => {
    if (refreshSeq === null || !viewKey) return;
    setCheckingViewKey(viewKey);
    trackRefresh();
  }, [refreshSeq, viewKey, trackRefresh]);

  const listIsEmpty = videos.length === 0;

  const handleFetchComplete = useCallback(({ lastResult }: FetchCompletion) => {
    const wasFollowingRefresh = checkingViewKey !== null && checkingViewKey === viewKey;
    setCheckingViewKey(null);
    if (!lastResult) {
      // Load More and Download All leave no result, and the user asked for
      // those, so the list reloads. A followed refresh whose result is gone
      // must not move the list.
      if (!wasFollowingRefresh) refetchVideos();
      return;
    }
    if (lastResult.failed) return;
    // A result is used once: a response sent while the refresh ran can arrive
    // after its end was seen, and following it again reports the same result.
    const resultKey = `${viewKey}:${lastResult.finishedAt}`;
    if (usedResultRef.current === resultKey) return;
    usedResultRef.current = resultKey;
    if (channelId) onVideosLoaded?.(channelId);
    if (lastResult.newVideos === 0 || !viewKey) return;
    if (listIsEmpty) {
      // Nothing on screen for a reload to move: the tab's first listing was
      // still running when this view asked for its rows.
      void refetchVideos();
      return;
    }
    // An offer still showing is for videos the list does not have yet either.
    setNotice((current) => ({
      key: viewKey,
      count: (current && current.key === viewKey ? current.count : 0) + lastResult.newVideos,
    }));
  }, [checkingViewKey, viewKey, refetchVideos, channelId, onVideosLoaded, listIsEmpty]);

  useEffect(() => {
    onFetchComplete(handleFetchComplete);
  }, [onFetchComplete, handleFetchComplete]);

  const show = useCallback(() => {
    setNotice(null);
    if (page === 1) {
      void refetchVideos();
    } else {
      setPage(1);
    }
    // Only when the top of the list has scrolled out of view (deep in an
    // infinite list); a page that already shows it stays where it is.
    const listTop = listTopRef.current;
    if (listTop && listTop.getBoundingClientRect().top < 0) {
      listTop.scrollIntoView?.({ block: 'start' });
    }
  }, [page, refetchVideos, setPage]);

  const dismiss = useCallback(() => {
    setNotice(null);
  }, []);

  return {
    checking: viewKey !== null && checkingViewKey === viewKey,
    newCount: notice && notice.key === viewKey ? notice.count : 0,
    show,
    dismiss,
    listTopRef,
  };
}
