import { act, renderHook } from '@testing-library/react';
import { useChannelListingActions } from '../useChannelListingActions';
import { useRefreshChannelVideos } from '../useRefreshChannelVideos';
import { useChannelFetchStatus } from '../useChannelFetchStatus';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../useRefreshChannelVideos', () => ({
  useRefreshChannelVideos: jest.fn(),
}));

jest.mock('../useChannelFetchStatus', () => ({
  useChannelFetchStatus: jest.fn(),
}));

type Props = Parameters<typeof useChannelListingActions>[0];

describe('useChannelListingActions', () => {
  const refreshVideos = jest.fn();
  const startPolling = jest.fn();
  let finishLoadMore: () => void;
  let props: Props;

  const stubRefresh = (overrides: Record<string, unknown> = {}) => {
    (useRefreshChannelVideos as jest.Mock).mockReturnValue({
      refreshVideos,
      loading: false,
      error: null,
      clearError: jest.fn(),
      ...overrides,
    });
  };

  const stubFetchStatus = (overrides: Record<string, unknown> = {}) => {
    (useChannelFetchStatus as jest.Mock).mockReturnValue({
      isFetching: false,
      fetchType: null,
      startTime: null,
      progress: null,
      onFetchComplete: jest.fn(),
      startPolling,
      trackRefresh: jest.fn(),
      ...overrides,
    });
  };

  const renderActions = () =>
    renderHook((hookProps: Props) => useChannelListingActions(hookProps), { initialProps: props });

  beforeEach(() => {
    jest.clearAllMocks();
    stubRefresh();
    stubFetchStatus();
    refreshVideos.mockImplementation(
      () => new Promise((resolve) => { finishLoadMore = () => resolve(null); })
    );
    props = {
      channelId: 'UC123',
      token: 'test-token',
      selectedTab: 'videos',
      page: 2,
      pageSize: 16,
      downloadedFilter: 'off',
      refetchVideos: jest.fn().mockResolvedValue(undefined),
      refetchTabStats: jest.fn().mockResolvedValue(undefined),
    };
  });

  test('refreshes the page and tab the list is showing', () => {
    renderActions();

    expect(useRefreshChannelVideos).toHaveBeenCalledWith('UC123', 2, 16, 'off', 'videos', 'test-token');
    expect(useChannelFetchStatus).toHaveBeenCalledWith('UC123', 'videos', 'test-token');
  });

  describe('Load More', () => {
    const startLoadMore = (result: { current: ReturnType<typeof useChannelListingActions> }) => {
      act(() => result.current.requestLoadMore());
      act(() => {
        void result.current.confirmLoadMore();
      });
    };

    test('asks for confirmation before loading', () => {
      const { result } = renderActions();

      act(() => result.current.requestLoadMore());

      expect(result.current.loadMoreConfirmOpen).toBe(true);
      expect(refreshVideos).not.toHaveBeenCalled();
    });

    test('cancelling closes the confirmation without loading', () => {
      const { result } = renderActions();
      act(() => result.current.requestLoadMore());

      act(() => result.current.cancelLoadMore());

      expect(result.current.loadMoreConfirmOpen).toBe(false);
      expect(refreshVideos).not.toHaveBeenCalled();
    });

    test('confirming closes the confirmation, follows the fetch status and loads', async () => {
      const { result } = renderActions();

      startLoadMore(result);

      expect(result.current.loadMoreConfirmOpen).toBe(false);
      expect(startPolling).toHaveBeenCalledTimes(1);
      expect(refreshVideos).toHaveBeenCalledTimes(1);
    });

    test('reloads the list and the tab counts when it finishes on the same tab', async () => {
      const { result } = renderActions();
      startLoadMore(result);

      await act(async () => finishLoadMore());

      expect(props.refetchVideos).toHaveBeenCalledTimes(1);
      expect(props.refetchTabStats).toHaveBeenCalledTimes(1);
    });

    test('does not reload the list while it is still loading', async () => {
      const { result } = renderActions();

      startLoadMore(result);

      expect(props.refetchVideos).not.toHaveBeenCalled();
    });

    test('reloads only the tab counts when the user switched to another tab', async () => {
      const { result, rerender } = renderActions();
      startLoadMore(result);
      rerender({ ...props, selectedTab: 'shorts' });

      await act(async () => finishLoadMore());

      expect(props.refetchVideos).not.toHaveBeenCalled();
      expect(props.refetchTabStats).toHaveBeenCalledTimes(1);
    });

    test('reloads nothing when the user switched to another channel', async () => {
      const { result, rerender } = renderActions();
      startLoadMore(result);
      rerender({ ...props, channelId: 'UC999' });

      await act(async () => finishLoadMore());

      expect(props.refetchVideos).not.toHaveBeenCalled();
      expect(props.refetchTabStats).not.toHaveBeenCalled();
    });

    test('passes on a Load More error and how to clear it', () => {
      const clearError = jest.fn();
      stubRefresh({ error: 'Fetch already running', clearError });

      const { result } = renderActions();

      expect(result.current).toMatchObject({
        loadMoreError: 'Fetch already running',
        clearLoadMoreError: clearError,
      });
    });
  });

  describe('Download All', () => {
    test('opening the dialog follows the fetch status its metadata fetch starts', () => {
      const { result } = renderActions();

      act(() => result.current.openDownloadAll());

      expect(result.current.downloadAllOpen).toBe(true);
      expect(startPolling).toHaveBeenCalledTimes(1);
    });

    test('closing the dialog leaves the page where it is', () => {
      const { result } = renderActions();
      act(() => result.current.openDownloadAll());

      act(() => result.current.closeDownloadAll());

      expect(result.current.downloadAllOpen).toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('closes the dialog and opens the activity page once the download starts', () => {
      const { result } = renderActions();
      act(() => result.current.openDownloadAll());

      act(() => result.current.onDownloadAllStarted());

      expect(result.current.downloadAllOpen).toBe(false);
      expect(mockNavigate).toHaveBeenCalledWith('/downloads/activity');
    });

    test('runs the same metadata fetch as Load More', () => {
      const { result } = renderActions();

      expect(result.current.runMetadataFetch).toBe(refreshVideos);
    });
  });

  describe('fetch status', () => {
    test.each([
      ['nothing is running', false, false, null, false, false],
      ['this page started a Load More', true, false, null, true, true],
      ['the server reports a Load More fetch', false, true, 'fetchAll', true, true],
      ['the server reports a background refresh', false, true, 'autoRefresh', true, false],
    ])(
      'when %s',
      (_case, loadMoreRunning, serverFetching, fetchType, isFetching, showLoadMoreProgress) => {
        stubRefresh({ loading: loadMoreRunning });
        stubFetchStatus({ isFetching: serverFetching, fetchType });

        const { result } = renderActions();

        expect(result.current).toMatchObject({ isFetching, showLoadMoreProgress });
      }
    );

    test('passes on the Load More progress', () => {
      const progress = { itemsFetched: 120, stage: 'listing' };
      stubFetchStatus({ isFetching: true, fetchType: 'fetchAll', progress });

      const { result } = renderActions();

      expect(result.current.fetchProgress).toBe(progress);
    });
  });
});
