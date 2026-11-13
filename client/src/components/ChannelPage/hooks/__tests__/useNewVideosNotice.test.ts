import { renderHook, act } from '@testing-library/react';
import { useNewVideosNotice } from '../useNewVideosNotice';
import { FetchCompletion } from '../useChannelFetchStatus';
import { ChannelVideo } from '../../../../types/ChannelVideo';

type Props = Parameters<typeof useNewVideosNotice>[0];

describe('useNewVideosNotice', () => {
  const storedVideos: ChannelVideo[] = [
    {
      title: 'Stored video',
      youtube_id: 'stored1',
      publishedAt: '2026-11-01T00:00:00Z',
      thumbnail: 'https://i.ytimg.com/vi/stored1/mqdefault.jpg',
      added: false,
      duration: 300,
      media_type: 'video',
      live_status: null,
    },
  ];

  let completeFetch: (completion: FetchCompletion) => void;
  let trackRefresh: jest.Mock;
  let refetchVideos: jest.Mock;
  let setPage: jest.Mock;
  let onVideosLoaded: jest.Mock;
  let baseProps: Props;

  const FIRST_REFRESH_END = '2026-11-13T12:00:00.000Z';
  const SECOND_REFRESH_END = '2026-11-13T13:30:00.000Z';
  const found = (newVideos: number, failed = false, finishedAt = FIRST_REFRESH_END): FetchCompletion => ({
    lastResult: { type: 'autoRefresh', newVideos, failed, finishedAt },
  });

  const renderNotice = (overrides: Partial<Props> = {}) =>
    renderHook((props: Props) => useNewVideosNotice(props), {
      initialProps: { ...baseProps, ...overrides },
    });

  beforeEach(() => {
    trackRefresh = jest.fn();
    refetchVideos = jest.fn().mockResolvedValue(undefined);
    setPage = jest.fn();
    onVideosLoaded = jest.fn();
    baseProps = {
      channelId: 'UC123',
      selectedTab: 'videos',
      refreshSeq: 1,
      resetKey: 'UC123|videos',
      videos: storedVideos,
      page: 1,
      setPage,
      refetchVideos,
      trackRefresh,
      onFetchComplete: (callback) => {
        completeFetch = callback;
      },
      onVideosLoaded,
    };
  });

  describe('following a background refresh', () => {
    test('follows the refresh the server reported', () => {
      const { result } = renderNotice();

      expect(trackRefresh).toHaveBeenCalledTimes(1);
      expect(result.current.checking).toBe(true);
    });

    test('follows nothing when the server reported no refresh', () => {
      const { result } = renderNotice({ refreshSeq: null });

      expect(trackRefresh).not.toHaveBeenCalled();
      expect(result.current.checking).toBe(false);
    });

    test('follows a later refresh of the same view', () => {
      const { result, rerender } = renderNotice();
      act(() => completeFetch(found(0)));

      rerender({ ...baseProps, refreshSeq: 2 });

      expect(trackRefresh).toHaveBeenCalledTimes(2);
      expect(result.current.checking).toBe(true);
    });

    test('stops checking when the view changes', () => {
      const { result, rerender } = renderNotice();

      rerender({ ...baseProps, selectedTab: 'shorts', refreshSeq: null });

      expect(result.current.checking).toBe(false);
    });
  });

  describe('when the refresh ends', () => {
    test('offers the videos it found', () => {
      const { result } = renderNotice();

      act(() => completeFetch(found(2)));

      expect(result.current.newCount).toBe(2);
      expect(result.current.checking).toBe(false);
    });

    test('leaves the list alone', () => {
      renderNotice();

      act(() => completeFetch(found(2)));

      expect(refetchVideos).not.toHaveBeenCalled();
    });

    test('offers nothing when it found no videos', () => {
      const { result } = renderNotice();

      act(() => completeFetch(found(0)));

      expect(result.current.newCount).toBe(0);
    });

    test('loads an empty list instead of offering', () => {
      // The tab's first listing was still running when this view asked for
      // its rows: there is nothing on screen for a reload to move.
      const { result } = renderNotice({ videos: [] });

      act(() => completeFetch(found(50)));

      expect(refetchVideos).toHaveBeenCalledTimes(1);
      expect(result.current.newCount).toBe(0);
    });

    test('tells the parent the channel was listed', () => {
      renderNotice();

      act(() => completeFetch(found(0)));

      expect(onVideosLoaded).toHaveBeenCalledWith('UC123');
    });

    test('offers nothing after a failed refresh', () => {
      const { result } = renderNotice();

      act(() => completeFetch(found(2, true)));

      expect(result.current.newCount).toBe(0);
      expect(onVideosLoaded).not.toHaveBeenCalled();
    });

    test('leaves the list alone when a followed refresh left no result', () => {
      const { result } = renderNotice();

      act(() => completeFetch({ lastResult: null }));

      expect(refetchVideos).not.toHaveBeenCalled();
      expect(result.current.checking).toBe(false);
    });

    test('reloads the list when a Load More ends', () => {
      renderNotice({ refreshSeq: null });

      act(() => completeFetch({ lastResult: null }));

      expect(refetchVideos).toHaveBeenCalledTimes(1);
    });
  });

  describe('the offer', () => {
    test('Show reloads the first page when it is on screen', () => {
      const { result } = renderNotice();
      act(() => completeFetch(found(2)));

      act(() => result.current.show());

      expect(refetchVideos).toHaveBeenCalledTimes(1);
      expect(setPage).not.toHaveBeenCalled();
      expect(result.current.newCount).toBe(0);
    });

    test('Show goes back to the first page from a later one', () => {
      const { result } = renderNotice({ page: 3 });
      act(() => completeFetch(found(2)));

      act(() => result.current.show());

      expect(setPage).toHaveBeenCalledWith(1);
      expect(refetchVideos).not.toHaveBeenCalled();
    });

    test('Dismiss withdraws the offer and leaves the list alone', () => {
      const { result } = renderNotice();
      act(() => completeFetch(found(2)));

      act(() => result.current.dismiss());

      expect(result.current.newCount).toBe(0);
      expect(refetchVideos).not.toHaveBeenCalled();
    });

    test('is withdrawn when the first page reloads for another reason', () => {
      const { result, rerender } = renderNotice();
      act(() => completeFetch(found(2)));

      rerender({ ...baseProps, videos: [...storedVideos] });

      expect(result.current.newCount).toBe(0);
    });

    test('stays while later pages load', () => {
      const { result, rerender } = renderNotice({ page: 2 });
      act(() => completeFetch(found(2)));

      rerender({ ...baseProps, page: 3, videos: [...storedVideos, ...storedVideos] });

      expect(result.current.newCount).toBe(2);
    });

    test('adds the videos a later refresh found to an offer still showing', () => {
      const { result, rerender } = renderNotice({ page: 2 });
      act(() => completeFetch(found(2)));
      rerender({ ...baseProps, page: 2, refreshSeq: 2 });

      act(() => completeFetch(found(1, false, SECOND_REFRESH_END)));

      expect(result.current.newCount).toBe(3);
    });

    test('counts a finished refresh once when it is reported again', () => {
      // A response sent while the refresh ran can arrive after its end was
      // seen; following it again reports the same result.
      const { result, rerender } = renderNotice({ page: 2 });
      act(() => completeFetch(found(2)));
      rerender({ ...baseProps, page: 2, refreshSeq: 2 });

      act(() => completeFetch(found(2)));

      expect(result.current.newCount).toBe(2);
    });

    test('is withdrawn when the list restarts', () => {
      const { result, rerender } = renderNotice({ page: 2 });
      act(() => completeFetch(found(2)));

      rerender({ ...baseProps, page: 2, resetKey: 'UC123|videos|oldest' });

      expect(result.current.newCount).toBe(0);
    });

    test('does not carry over to another tab', () => {
      const { result, rerender } = renderNotice({ page: 2 });
      act(() => completeFetch(found(2)));

      rerender({ ...baseProps, page: 2, selectedTab: 'shorts', refreshSeq: null });

      expect(result.current.newCount).toBe(0);
    });
  });
});
