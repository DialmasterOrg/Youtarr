import React, { useState } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import axios from 'axios';
import useMediaQuery from '../../../hooks/useMediaQuery';
import ChannelVideos from '../ChannelVideos';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { renderWithProviders, createMockWebSocketContext } from '../../../test-utils';
import { useChannelVideos } from '../hooks/useChannelVideos';
import { useChannelFetchStatus } from '../hooks/useChannelFetchStatus';
import { useChannelTabStats } from '../hooks/useChannelTabStats';
import { useRefreshChannelVideos } from '../hooks/useRefreshChannelVideos';
import { useVideoDeletion } from '../../shared/useVideoDeletion';
import { useConfig } from '../../../hooks/useConfig';
import { useTriggerDownloads } from '../../../hooks/useTriggerDownloads';

// These tests cover how ChannelVideos wires its hooks and views together.
// The rules of each piece are tested beside it, in hooks/__tests__ and
// components/__tests__.

jest.mock('../../../hooks/useMediaQuery');

const mockNavigate = jest.fn();
const mockParams: { channel_id: string | undefined } = { channel_id: 'UC123456' };
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => mockParams,
  useNavigate: () => mockNavigate,
}));

jest.mock('react-swipeable', () => ({
  useSwipeable: () => ({}),
}));

jest.mock('../VideoCard', () => ({
  __esModule: true,
  default: function MockVideoCard({
    video,
    selectionMode,
    onCheckChange,
    onDeletionChange,
    onToggleIgnore,
    onVideoClick,
  }: {
    video: { youtube_id: string; title: string; ignored?: boolean };
    selectionMode: 'download' | 'delete' | null;
    onCheckChange: (videoId: string, isChecked: boolean) => void;
    onDeletionChange: (videoId: string, isChecked: boolean) => void;
    onToggleIgnore: (videoId: string) => void;
    onVideoClick: (video: unknown) => void;
  }) {
    const React = require('react');
    const button = (testId: string, label: string, onClick: () => void, disabled = false) =>
      React.createElement(
        'button',
        { type: 'button', 'data-testid': `${testId}-${video.youtube_id}`, disabled, onClick },
        label
      );
    // Like the real card, the checkbox of the other selection mode is disabled.
    return React.createElement(
      'div',
      {
        'data-testid': `video-card-${video.youtube_id}`,
        'data-selection-mode': selectionMode ?? 'null',
        'data-ignored': String(Boolean(video.ignored)),
      },
      React.createElement('span', null, video.title),
      button('toggle-ignore', 'Toggle ignore', () => onToggleIgnore(video.youtube_id)),
      button('select-video', 'Select', () => onCheckChange(video.youtube_id, true), selectionMode === 'delete'),
      button('select-delete', 'Select for delete', () => onDeletionChange(video.youtube_id, true), selectionMode === 'download'),
      // Never disabled: stands for a card whose own gate failed, so both
      // kinds of selection can exist at once.
      button('force-select-delete', 'Force select for delete', () => onDeletionChange(video.youtube_id, true)),
      button('open-video', 'Open', () => onVideoClick(video))
    );
  },
}));

jest.mock('../VideoListItem', () => ({
  __esModule: true,
  default: function MockVideoListItem({ video }: { video: { youtube_id: string; title: string } }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': `video-list-item-${video.youtube_id}` }, video.title);
  },
}));

jest.mock('../VideoTableView', () => ({
  __esModule: true,
  default: function MockVideoTableView({ videos }: { videos: unknown[] }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'video-table-view' }, `Table with ${videos.length} videos`);
  },
}));

// A minimal stand-in for the shared list container: it renders the slots it is
// given, the content or empty state, the selection pill's actions, and one
// control for the watched filter.
jest.mock('../../shared/VideoList', () => {
  const React = require('react');
  const actual = jest.requireActual('../../shared/VideoList');
  interface MockSelection {
    hasSelection: boolean;
    count: number;
    selectedIds: string[];
    clear: () => void;
    actions: Array<{ id: string; label: string; onClick: (selectedIds: string[]) => void }>;
  }
  interface MockContainerProps {
    state: { viewMode: string };
    selection?: MockSelection;
    filters: Array<{ id: string; value?: string; onChange?: (value: string) => void }>;
    headerSlot: unknown;
    tabsSlot: unknown;
    itemCount: number;
    isLoading: boolean;
    isError: boolean;
    errorMessage?: string;
    loadingSkeleton?: unknown;
    renderContent: (viewMode: string) => unknown;
    infiniteScrollSentinel: unknown;
    pagination: unknown;
  }
  return {
    ...actual,
    VideoListContainer: function MockVideoListContainer(props: MockContainerProps) {
      const { selection } = props;
      const selectionPill = selection?.hasSelection
        ? React.createElement(
            'div',
            null,
            React.createElement(
              'button',
              {
                type: 'button',
                'data-testid': 'video-list-selection-pill',
                'aria-label': `Actions for ${selection.count} selected video${selection.count !== 1 ? 's' : ''}`,
              },
              'Selection FAB'
            ),
            React.createElement(
              'ul',
              { role: 'menu' },
              ...selection.actions.map((action) =>
                React.createElement(
                  'li',
                  { key: action.id, role: 'menuitem', onClick: () => action.onClick(selection.selectedIds) },
                  `${action.label} Selected`
                )
              ),
              React.createElement('li', { role: 'menuitem', onClick: () => selection.clear() }, 'Clear Selection')
            )
          )
        : null;
      let emptyContent = React.createElement('div', { 'data-testid': 'video-list-empty-state' }, 'No videos found');
      if (props.isLoading) emptyContent = props.loadingSkeleton;
      if (props.isError) emptyContent = React.createElement('div', { role: 'alert' }, props.errorMessage);
      const watchedFilter = props.filters.find((filter) => filter.id === 'watched');
      return React.createElement(
        'div',
        { 'data-testid': 'video-list-container' },
        props.headerSlot,
        props.tabsSlot,
        React.createElement(
          'button',
          { type: 'button', 'data-testid': 'watched-filter-only', onClick: () => watchedFilter?.onChange?.('only') },
          `Watched: ${watchedFilter?.value}`
        ),
        props.itemCount === 0 ? emptyContent : props.renderContent(props.state.viewMode),
        props.infiniteScrollSentinel,
        props.pagination,
        selectionPill
      );
    },
  };
});

jest.mock('../ChannelVideosDialogs', () => ({
  __esModule: true,
  default: function MockChannelVideosDialogs(props: {
    downloadDialogOpen: boolean;
    deleteDialogOpen: boolean;
    successMessage: string | null;
    videoCount: number;
    missingVideoCount: number;
    defaultResolution: string;
    defaultResolutionSource: string;
    defaultAudioFormat?: string | null;
    defaultAudioFormatSource?: string;
    defaultProtect?: boolean;
    tabStats?: { total: number | null; loaded?: number };
    onRefreshConfirm: () => void;
  }) {
    const React = require('react');
    return React.createElement(
      'div',
      {
        'data-testid': 'channel-videos-dialogs',
        'data-download-dialog-open': String(props.downloadDialogOpen),
        'data-delete-dialog-open': String(props.deleteDialogOpen),
        'data-success-message': props.successMessage ?? '',
        'data-video-count': props.videoCount,
        'data-missing-video-count': props.missingVideoCount,
        'data-default-resolution': props.defaultResolution,
        'data-default-resolution-source': props.defaultResolutionSource,
        'data-default-audio-format': String(props.defaultAudioFormat),
        'data-default-audio-format-source': props.defaultAudioFormatSource,
        'data-default-protect': String(props.defaultProtect),
        'data-tab-total': props.tabStats?.total,
        'data-tab-loaded': props.tabStats?.loaded,
      },
      React.createElement('button', { onClick: () => props.onRefreshConfirm() }, 'Mock confirm Load More')
    );
  },
}));

jest.mock('../DownloadAllVideosDialog', () => ({
  __esModule: true,
  default: function MockDownloadAllVideosDialog(props: {
    open: boolean;
    tabType: string;
    defaultProtect?: boolean;
  }) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'download-all-dialog',
      'data-default-protect': String(props.defaultProtect),
      'data-open': String(props.open),
      'data-tab-type': props.tabType,
    });
  },
}));

jest.mock('../../shared/VideoModal', () => ({
  __esModule: true,
  default: function MockVideoModal(props: {
    video: { youtubeId: string; title: string; channelName: string };
    onIgnoreChanged: (youtubeId: string, isIgnored: boolean) => void;
  }) {
    const React = require('react');
    return React.createElement(
      'div',
      { role: 'dialog', 'aria-label': props.video.title, 'data-channel-name': props.video.channelName },
      React.createElement(
        'button',
        { onClick: () => props.onIgnoreChanged(props.video.youtubeId, true) },
        'Mock modal ignore'
      )
    );
  },
}));

jest.mock('../hooks/useChannelVideos', () => ({
  useChannelVideos: jest.fn(),
}));

jest.mock('../hooks/useRefreshChannelVideos', () => ({
  useRefreshChannelVideos: jest.fn(),
}));

// beforeEach installs the real hook; the background refresh tests swap in a stub they control.
jest.mock('../hooks/useChannelFetchStatus', () => ({
  ...jest.requireActual('../hooks/useChannelFetchStatus'),
  useChannelFetchStatus: jest.fn(),
}));

jest.mock('../hooks/useChannelTabStats', () => ({
  useChannelTabStats: jest.fn(),
}));

jest.mock('../../../hooks/useConfig', () => ({
  useConfig: jest.fn(),
}));

jest.mock('../../../hooks/useTriggerDownloads', () => ({
  useTriggerDownloads: jest.fn(),
}));

jest.mock('../../shared/useVideoDeletion', () => ({
  useVideoDeletion: jest.fn(),
}));

// The channel's tabs are read with axios.get and ignores are saved with axios.post.
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));
const mockGet = axios.get as jest.Mock;
const mockPost = axios.post as jest.Mock;

// Only the real fetch status hook still uses fetch.
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const mockUseChannelVideos = useChannelVideos as jest.Mock;
const mockUseChannelFetchStatus = useChannelFetchStatus as jest.Mock;
const mockUseChannelTabStats = useChannelTabStats as jest.Mock;
const mockUseRefreshChannelVideos = useRefreshChannelVideos as jest.Mock;
const mockUseConfig = useConfig as jest.Mock;
const actualUseChannelFetchStatus =
  jest.requireActual('../hooks/useChannelFetchStatus').useChannelFetchStatus;

describe('ChannelVideos', () => {
  const mockToken = 'test-token';
  const mockRefetchVideos = jest.fn();
  const mockRefreshVideos = jest.fn();
  const mockRefetchTabStats = jest.fn();

  const video = (youtubeId: string, title: string, overrides: Partial<ChannelVideo> = {}): ChannelVideo => ({
    title,
    youtube_id: youtubeId,
    publishedAt: '2023-01-01T00:00:00Z',
    thumbnail: `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`,
    added: false,
    duration: 300,
    media_type: 'video',
    live_status: null,
    ...overrides,
  });

  const mockVideos: ChannelVideo[] = [
    video('video1', 'Test Video 1'),
    video('video2', 'Test Video 2', { added: true, removed: false }),
    video('short1', 'Test Short 1', { media_type: 'short', duration: 30 }),
  ];
  const missingVideo = video('missing1', 'Missing Video', { added: true, removed: true });

  // What the videos hook hands back for a loaded list.
  const listed = (videos: ChannelVideo[], overrides: Record<string, unknown> = {}) => ({
    videos,
    totalCount: videos.length,
    oldestVideoDate: null,
    error: null,
    autoDownloadsEnabled: false,
    availableTabs: [],
    loading: false,
    refreshSeq: null,
    loadedView: null,
    refetch: mockRefetchVideos,
    ...overrides,
  });
  const listVideos = (videos: ChannelVideo[], overrides: Record<string, unknown> = {}) =>
    mockUseChannelVideos.mockReturnValue(listed(videos, overrides));

  const tabStatsAre = (data: Record<string, unknown> | null) =>
    mockUseChannelTabStats.mockReturnValue({ data, loading: false, error: null, refetch: mockRefetchTabStats });
  const countedTab = { total: 10, fetchedAt: null, downloaded: 5, ignored: 0, percent: 50, loaded: 8 };

  // Replaces the fetch status hook with one the test completes by hand.
  type Completion = { lastResult: { type: string; newVideos: number; failed: boolean; finishedAt: string } | null };
  const mockTrackRefresh = jest.fn();
  let completeFetch: (completion: Completion) => void;
  const stubFetchStatus = (overrides: Record<string, unknown> = {}) => {
    mockUseChannelFetchStatus.mockImplementation(() => ({
      isFetching: false,
      fetchType: null,
      startTime: null,
      progress: null,
      onFetchComplete: (callback: (completion: Completion) => void) => {
        completeFetch = callback;
      },
      startPolling: jest.fn(),
      trackRefresh: mockTrackRefresh,
      ...overrides,
    }));
  };

  const serverTabsAre = (availableTabs: string[]) =>
    mockGet.mockResolvedValue({ data: { availableTabs } });

  const renderChannelVideos = (props: Partial<React.ComponentProps<typeof ChannelVideos>> = {}) =>
    renderWithProviders(<ChannelVideos token={mockToken} {...props} />, {
      websocketValue: createMockWebSocketContext(),
    });

  // Every render asks for the channel's tabs; this waits for the answer to show.
  const renderWithTabsLoaded = async (props: Partial<React.ComponentProps<typeof ChannelVideos>> = {}) => {
    renderChannelVideos(props);
    await screen.findByRole('tab', { name: /Videos/i });
  };

  const dialogs = () => screen.getByTestId('channel-videos-dialogs');
  const lastVideosQuery = () => mockUseChannelVideos.mock.calls[mockUseChannelVideos.mock.calls.length - 1][0];
  const openSelectionMenu = async (count = 1) =>
    userEvent.click(await screen.findByRole('button', { name: `Actions for ${count} selected video${count === 1 ? '' : 's'}` }));

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockPost.mockReset();
    mockPost.mockResolvedValue({ data: {} });
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ isFetching: false }) });
    mockParams.channel_id = 'UC123456';
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    localStorage.removeItem('youtarr.channelVideos.pageSize');
    // Most tests drive the mocked cards, so pin the grid view; the default
    // view tests remove this.
    localStorage.setItem('youtarr:channelVideosViewMode', 'grid');

    listVideos([]);
    tabStatsAre(null);
    serverTabsAre(['videos']);
    mockUseChannelFetchStatus.mockImplementation(actualUseChannelFetchStatus);
    mockUseRefreshChannelVideos.mockReturnValue({
      refreshVideos: mockRefreshVideos,
      loading: false,
      error: null,
      clearError: jest.fn(),
    });
    (useVideoDeletion as jest.Mock).mockReturnValue({ deleteVideosByYoutubeIds: jest.fn(), loading: false });
    mockUseConfig.mockReturnValue({ config: { preferredResolution: '1080' } });
    (useTriggerDownloads as jest.Mock).mockReturnValue({ triggerDownloads: jest.fn() });
  });

  describe('list states', () => {
    test('shows the loading message while the first page loads', async () => {
      listVideos([], { loading: true });

      await renderWithTabsLoaded();

      expect(screen.getByText('Loading and fetching/indexing new videos for this channel tab...')).toBeInTheDocument();
    });

    test('shows the empty state, not an error, when the tab has no videos', async () => {
      await renderWithTabsLoaded();

      expect(screen.getByTestId('video-list-empty-state')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('shows an error when the videos could not be fetched', async () => {
      listVideos([], { error: new Error('Network error') });

      await renderWithTabsLoaded();

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch channel videos. Please try again later.');
    });

    test('shows the table by default on desktop', async () => {
      localStorage.removeItem('youtarr:channelVideosViewMode');
      listVideos(mockVideos);

      await renderWithTabsLoaded();

      expect(screen.getByTestId('video-table-view')).toHaveTextContent('Table with 3 videos');
    });

    test('shows the list by default on mobile', async () => {
      localStorage.removeItem('youtarr:channelVideosViewMode');
      (useMediaQuery as jest.Mock).mockReturnValue(true);
      listVideos(mockVideos);

      await renderWithTabsLoaded();

      expect(screen.getByTestId('video-list-item-video1')).toBeInTheDocument();
      expect(screen.queryByTestId('video-card-video1')).not.toBeInTheDocument();
    });
  });

  describe('fetching videos', () => {
    test('asks for the first page of the route channel, newest first and unfiltered', async () => {
      await renderWithTabsLoaded();

      // The tab is not known until the tabs request answers.
      expect(mockUseChannelVideos).toHaveBeenCalledWith(expect.objectContaining({
        channelId: 'UC123456',
        page: 1,
        pageSize: 16,
        downloadedFilter: 'off',
        searchQuery: '',
        sortBy: 'date',
        sortOrder: 'desc',
        tabType: null,
        token: mockToken,
        minDuration: null,
        maxDuration: null,
        dateFrom: null,
        dateTo: null,
        maxRating: '',
        append: false,
        resetKey: expect.any(String),
        protectedFilter: 'off',
        missingFilter: 'off',
        deletedFilter: 'off',
        ignoredFilter: 'off',
        watchedFilter: 'off',
      }));
    });

    test('uses the same page size on mobile', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);

      await renderWithTabsLoaded();

      expect(lastVideosQuery().pageSize).toBe(16);
    });

    test('sets Load More up for the same channel, page, page size and filter', async () => {
      await renderWithTabsLoaded();

      expect(mockUseRefreshChannelVideos).toHaveBeenCalledWith('UC123456', 1, 16, 'off', null, mockToken);
    });

    test('prefers the channelId prop over the route param', async () => {
      renderChannelVideos({ channelId: 'UCCustomChannel' });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/api/channels/UCCustomChannel/tabs', expect.anything());
      });
      expect(lastVideosQuery().channelId).toBe('UCCustomChannel');
    });

    test('setting a filter fetches the filtered list from the first page', async () => {
      listVideos(mockVideos, { totalCount: 48 });
      renderChannelVideos();
      await userEvent.click(screen.getAllByRole('button', { name: 'go to page 2' })[0]);

      await userEvent.click(screen.getByTestId('watched-filter-only'));

      await waitFor(() => {
        expect(lastVideosQuery()).toMatchObject({ watchedFilter: 'only', page: 1 });
      });
    });

    test('shows how many videos match while a filter is on', async () => {
      listVideos(mockVideos);
      renderChannelVideos();

      await userEvent.click(await screen.findByTestId('watched-filter-only'));

      expect(await screen.findByText('3 matches')).toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    test('shows no tabs until the server lists them', async () => {
      let answerTabs: (response: unknown) => void = () => {};
      mockGet.mockReturnValueOnce(new Promise((resolve) => { answerTabs = resolve; }));
      renderChannelVideos();
      const tabsWhileWaiting = screen.queryAllByRole('tab').length;

      answerTabs({ data: { availableTabs: ['videos', 'shorts', 'streams'] } });

      expect(await screen.findByRole('tab', { name: /Live/i })).toBeInTheDocument();
      expect(tabsWhileWaiting).toBe(0);
    });

    test('shows the tabs the video listing reports', async () => {
      mockGet.mockReturnValue(new Promise(() => {}));
      listVideos(mockVideos, { availableTabs: ['videos', 'shorts'] });

      renderChannelVideos();

      expect(await screen.findByRole('tab', { name: /Shorts/i })).toBeInTheDocument();
    });

    test('marks the tabs that download automatically', async () => {
      serverTabsAre(['videos', 'shorts']);

      renderChannelVideos({ channelAutoDownloadTabs: 'short' });

      const shortsTab = await screen.findByRole('tab', { name: /Shorts/i });
      expect(within(shortsTab).getByTitle('Auto-download enabled')).toBeInTheDocument();
    });

    test('switching tab fetches that tab', async () => {
      serverTabsAre(['videos', 'shorts']);
      renderChannelVideos();

      await userEvent.click(await screen.findByRole('tab', { name: /Shorts/i }));

      await waitFor(() => expect(lastVideosQuery().tabType).toBe('shorts'));
    });

    test('switching tab turns the status filters off', async () => {
      serverTabsAre(['videos', 'shorts']);
      renderChannelVideos();
      await userEvent.click(await screen.findByTestId('watched-filter-only'));

      await userEvent.click(await screen.findByRole('tab', { name: /Shorts/i }));

      await waitFor(() => expect(lastVideosQuery()).toMatchObject({ tabType: 'shorts', watchedFilter: 'off' }));
    });

    test('switching tab drops the selection', async () => {
      serverTabsAre(['videos', 'shorts']);
      listVideos(mockVideos);
      renderChannelVideos();
      await userEvent.click(screen.getByTestId('select-video-video1'));

      await userEvent.click(await screen.findByRole('tab', { name: /Shorts/i }));

      await waitFor(() => expect(dialogs()).toHaveAttribute('data-video-count', '0'));
    });

    test('ignores a tab click while videos are loading', async () => {
      serverTabsAre(['videos', 'shorts']);
      listVideos(mockVideos, { loading: true });
      renderChannelVideos();

      await userEvent.click(await screen.findByRole('tab', { name: /Shorts/i }));

      expect(lastVideosQuery().tabType).toBe('videos');
    });

    test('updates the tab strip when the parent passes a new tab list', async () => {
      // The tabs request and the prop agree at first, so their order does not matter.
      serverTabsAre(['videos', 'shorts', 'streams']);
      let setTabsProp: (value: string) => void = () => {};
      const Harness = () => {
        const [tabs, setTabs] = useState('videos,shorts,streams');
        setTabsProp = setTabs;
        return <ChannelVideos token={mockToken} channelAvailableTabs={tabs} />;
      };
      renderWithProviders(<Harness />);
      expect(await screen.findByRole('tab', { name: /Shorts/i })).toBeInTheDocument();

      act(() => setTabsProp('videos,streams'));

      await waitFor(() => expect(screen.queryByRole('tab', { name: /Shorts/i })).not.toBeInTheDocument());
      expect(screen.getByRole('tab', { name: /Live/i })).toBeInTheDocument();
    });
  });

  describe('tab download stats', () => {
    test('are reloaded when the listing size changes', async () => {
      const { rerender } = renderChannelVideos();
      expect(await screen.findByTestId('channel-videos-header')).toBeInTheDocument();
      mockRefetchTabStats.mockClear();

      listVideos(mockVideos, { totalCount: 50 });
      rerender(<ChannelVideos token={mockToken} />);

      await waitFor(() => expect(mockRefetchTabStats).toHaveBeenCalledTimes(1));
    });

    test('are reloaded when another tab loads the same number of videos', async () => {
      listVideos(mockVideos, { totalCount: 50, loadedView: 'UC123456:videos' });
      const { rerender } = renderChannelVideos();
      expect(await screen.findByTestId('channel-videos-header')).toBeInTheDocument();
      mockRefetchTabStats.mockClear();

      listVideos(mockVideos, { totalCount: 50, loadedView: 'UC123456:shorts' });
      rerender(<ChannelVideos token={mockToken} />);

      await waitFor(() => expect(mockRefetchTabStats).toHaveBeenCalledTimes(1));
    });

    test('are not reloaded on the first render', async () => {
      renderChannelVideos();

      expect(await screen.findByTestId('channel-videos-header')).toBeInTheDocument();
      expect(mockRefetchTabStats).not.toHaveBeenCalled();
    });

    test('are reloaded after a video is ignored', async () => {
      listVideos([mockVideos[0]]);
      renderChannelVideos();

      await userEvent.click(await screen.findByTestId('toggle-ignore-video1'));

      await waitFor(() => expect(mockRefetchTabStats).toHaveBeenCalled());
    });

    test('for the selected tab reach the header and the Load More dialog', async () => {
      tabStatsAre({ videos: countedTab });

      renderChannelVideos();

      expect(await screen.findByTestId('tab-download-summary')).toHaveTextContent('5 of 10 downloaded · 8 loaded');
      expect([dialogs().getAttribute('data-tab-total'), dialogs().getAttribute('data-tab-loaded')]).toEqual(['10', '8']);
    });
  });

  describe('Load More and Download All', () => {
    test('Download All opens its dialog for the selected tab', async () => {
      renderChannelVideos();
      await screen.findByRole('tab', { name: /Videos/i });
      const openBefore = screen.getByTestId('download-all-dialog').getAttribute('data-open');

      fireEvent.click(screen.getByTestId('channel-download-all-button'));

      expect(openBefore).toBe('false');
      expect(screen.getByTestId('download-all-dialog')).toHaveAttribute('data-open', 'true');
      expect(screen.getByTestId('download-all-dialog')).toHaveAttribute('data-tab-type', 'videos');
    });

    test('confirming Load More loads from YouTube, then reloads the list', async () => {
      mockRefreshVideos.mockResolvedValue(null);
      stubFetchStatus();
      renderChannelVideos();
      await screen.findByRole('tab', { name: /Videos/i });
      mockRefetchVideos.mockClear();

      await userEvent.click(screen.getByRole('button', { name: 'Mock confirm Load More' }));

      await waitFor(() => expect(mockRefetchVideos).toHaveBeenCalled());
      expect(mockRefreshVideos).toHaveBeenCalledTimes(1);
    });
  });

  describe('selection', () => {
    beforeEach(() => {
      listVideos([...mockVideos, missingVideo]);
    });

    test('a video selected for download puts every row in download mode with the download actions', async () => {
      renderChannelVideos();

      await userEvent.click(screen.getByTestId('select-video-video1'));
      await openSelectionMenu();

      expect(screen.getByTestId('video-card-video2')).toHaveAttribute('data-selection-mode', 'download');
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'Download Selected',
        'Ignore Selected',
        'Clear Selection',
      ]);
    });

    test('a video selected for deletion puts every row in delete mode with the delete action', async () => {
      renderChannelVideos();

      await userEvent.click(screen.getByTestId('select-delete-video2'));
      await openSelectionMenu();

      expect(screen.getByTestId('video-card-video1')).toHaveAttribute('data-selection-mode', 'delete');
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'Delete Selected',
        'Clear Selection',
      ]);
    });

    test('Clear Selection on the pill empties both kinds of selection', async () => {
      renderChannelVideos();
      await userEvent.click(screen.getByTestId('select-video-video1'));
      await userEvent.click(screen.getByTestId('force-select-delete-video2'));
      await openSelectionMenu();

      await userEvent.click(screen.getByRole('menuitem', { name: 'Clear Selection' }));

      await waitFor(() => expect(screen.queryByTestId('video-list-selection-pill')).not.toBeInTheDocument());
      expect(screen.getByTestId('video-card-video1')).toHaveAttribute('data-selection-mode', 'null');
    });

    test('Download Selected opens the download dialog with the selected and missing counts', async () => {
      renderChannelVideos();
      await userEvent.click(screen.getByTestId('select-video-video1'));
      await userEvent.click(screen.getByTestId('select-video-missing1'));
      await openSelectionMenu(2);

      await userEvent.click(screen.getByRole('menuitem', { name: 'Download Selected' }));

      expect(dialogs()).toHaveAttribute('data-download-dialog-open', 'true');
      expect(dialogs()).toHaveAttribute('data-video-count', '2');
      expect(dialogs()).toHaveAttribute('data-missing-video-count', '1');
    });

    test('Delete Selected asks for confirmation', async () => {
      renderChannelVideos();
      await userEvent.click(screen.getByTestId('select-delete-video2'));
      await openSelectionMenu();

      await userEvent.click(screen.getByRole('menuitem', { name: 'Delete Selected' }));

      expect(dialogs()).toHaveAttribute('data-delete-dialog-open', 'true');
    });

    test('Ignore Selected ignores the selected videos and shows them as ignored', async () => {
      renderChannelVideos();
      await userEvent.click(screen.getByTestId('select-video-video1'));
      await openSelectionMenu();
      mockPost.mockResolvedValueOnce({ data: { message: 'Ignored 1 video' } });

      await userEvent.click(screen.getByRole('menuitem', { name: 'Ignore Selected' }));

      await waitFor(() => expect(dialogs()).toHaveAttribute('data-success-message', 'Ignored 1 video'));
      expect(mockPost).toHaveBeenCalledWith(
        '/api/channels/UC123456/videos/bulk-ignore',
        { youtubeIds: ['video1'] },
        expect.anything()
      );
      expect(screen.getByTestId('video-card-video1')).toHaveAttribute('data-ignored', 'true');
    });
  });

  describe('row actions', () => {
    test('ignoring a video saves it, shows it as ignored and says so', async () => {
      listVideos(mockVideos);
      renderChannelVideos();
      await screen.findByRole('tab', { name: /Videos/i });

      await userEvent.click(screen.getByTestId('toggle-ignore-video1'));

      await waitFor(() => {
        expect(dialogs()).toHaveAttribute(
          'data-success-message',
          'Video ignored. Channel downloads will exclude this video'
        );
      });
      expect(mockPost).toHaveBeenCalledWith(
        '/api/channels/UC123456/videos/video1/ignore',
        undefined,
        expect.anything()
      );
      expect(screen.getByTestId('video-card-video1')).toHaveAttribute('data-ignored', 'true');
    });

    test('opening a video shows it in the video modal with the channel name', async () => {
      listVideos(mockVideos);
      renderChannelVideos({ channelName: 'Some Channel' });

      await userEvent.click(screen.getByTestId('open-video-video2'));

      expect(screen.getByRole('dialog', { name: 'Test Video 2' })).toHaveAttribute('data-channel-name', 'Some Channel');
    });

    test('a change made in the video modal shows on the row', async () => {
      listVideos(mockVideos);
      renderChannelVideos();
      await userEvent.click(screen.getByTestId('open-video-video2'));

      await userEvent.click(screen.getByRole('button', { name: 'Mock modal ignore' }));

      expect(screen.getByTestId('video-card-video2')).toHaveAttribute('data-ignored', 'true');
    });

    describe('with a second page loaded', () => {
      const originalIntersectionObserver = window.IntersectionObserver;
      let sentinelScrolledIntoView: () => void;

      beforeEach(() => {
        window.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
          const observer = { observe: jest.fn(), disconnect: jest.fn() } as unknown as IntersectionObserver;
          sentinelScrolledIntoView = () =>
            callback(
              [{ isIntersecting: true, boundingClientRect: { bottom: 0 }, rootBounds: { height: 0 } } as IntersectionObserverEntry],
              observer
            );
          return observer;
        }) as unknown as typeof IntersectionObserver;
        listVideos(mockVideos, { totalCount: 48 });
      });

      afterEach(() => {
        window.IntersectionObserver = originalIntersectionObserver;
      });

      const ignoreFirstVideo = async () => {
        await userEvent.click(screen.getByTestId('toggle-ignore-video1'));
        await waitFor(() => expect(screen.getByTestId('video-card-video1')).toHaveAttribute('data-ignored', 'true'));
      };

      const scrollToSecondPageWithFirstVideoIgnored = async () => {
        mockUseConfig.mockReturnValue({ config: { preferredResolution: '1080', channelVideosHotLoad: true } });
        renderChannelVideos();
        await screen.findByRole('tab', { name: /Videos/i });
        await ignoreFirstVideo();
        act(() => sentinelScrolledIntoView());
        await waitFor(() => expect(lastVideosQuery().page).toBe(2));
      };

      test('infinite scroll keeps an ignored row ignored, because the row is not loaded again', async () => {
        await scrollToSecondPageWithFirstVideoIgnored();

        expect(screen.getByTestId('video-card-video1')).toHaveAttribute('data-ignored', 'true');
      });

      test('going back to the first page of an infinite list shows the rows as that page loaded them', async () => {
        stubFetchStatus();
        listVideos(mockVideos, { totalCount: 48, refreshSeq: 1 });
        await scrollToSecondPageWithFirstVideoIgnored();
        act(() => completeFetch({
          lastResult: { type: 'autoRefresh', newVideos: 2, failed: false, finishedAt: '2026-11-13T12:00:00.000Z' },
        }));

        await userEvent.click(screen.getByRole('button', { name: 'Show' }));

        await waitFor(() => expect(lastVideosQuery().page).toBe(1));
        expect(screen.getByTestId('video-card-video1')).toHaveAttribute('data-ignored', 'false');
      });

      describe('after a load failed with rows on screen', () => {
        const renderWithFailedLoad = async () => {
          mockUseConfig.mockReturnValue({ config: { preferredResolution: '1080', channelVideosHotLoad: true } });
          listVideos(mockVideos, { totalCount: 48, error: new Error('Network error') });
          // Stays a no-op unless the list starts watching its sentinel.
          sentinelScrolledIntoView = () => undefined;
          renderChannelVideos();
          await screen.findByRole('tab', { name: /Videos/i });
        };

        test('infinite scroll does not ask for the page after the one that failed', async () => {
          await renderWithFailedLoad();

          act(() => sentinelScrolledIntoView());

          expect(lastVideosQuery().page).toBe(1);
        });

        test('Retry reloads the list', async () => {
          await renderWithFailedLoad();

          await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

          expect(mockRefetchVideos).toHaveBeenCalledTimes(1);
        });
      });

      test('a paged list shows the rows as the next page loaded them', async () => {
        renderChannelVideos();
        await screen.findByRole('tab', { name: /Videos/i });
        await ignoreFirstVideo();

        await userEvent.click(screen.getAllByRole('button', { name: 'go to page 2' })[0]);

        await waitFor(() => expect(screen.getByTestId('video-card-video1')).toHaveAttribute('data-ignored', 'false'));
      });
    });
  });

  describe('pagination', () => {
    test('shows the page size selector without page buttons for a single page', async () => {
      listVideos(mockVideos);

      await renderWithTabsLoaded();

      expect(within(screen.getByTestId('video-list-pagination-bar-bottom')).getByRole('button', { name: '16' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'go to page 2' })).not.toBeInTheDocument();
    });

    test('shows page buttons when there are more pages', async () => {
      listVideos(mockVideos, { totalCount: 32 });

      await renderWithTabsLoaded();

      expect(screen.getByRole('button', { name: 'go to page 2' })).toBeInTheDocument();
    });

    test.each([
      ['an empty list', { loading: false }],
      ['a list that is still loading', { loading: true }],
    ])('shows no pagination bar for %s', async (_case, overrides) => {
      listVideos([], overrides);

      await renderWithTabsLoaded();

      expect(screen.queryByTestId('video-list-pagination-bar-bottom')).not.toBeInTheDocument();
    });

    test('fetches with the stored page size', async () => {
      localStorage.setItem('youtarr.channelVideos.pageSize', '32');

      await renderWithTabsLoaded();

      expect(lastVideosQuery().pageSize).toBe(32);
    });

    test('changing the page size stores it and fetches the first page again', async () => {
      listVideos(mockVideos, { totalCount: 48 });
      renderChannelVideos();
      await userEvent.click(screen.getByRole('button', { name: 'go to page 2' }));
      const pageBeforeChange = lastVideosQuery().page;

      // The Select opens on mouseDown of its trigger, which shows the current size.
      fireEvent.mouseDown(within(screen.getByRole('button', { name: '16' })).getByText('16'));
      await userEvent.click(await screen.findByRole('option', { name: '32' }));

      expect(pageBeforeChange).toBe(2);
      expect(localStorage.getItem('youtarr.channelVideos.pageSize')).toBe('32');
      expect(lastVideosQuery()).toMatchObject({ pageSize: 32, page: 1 });
    });
  });

  describe('download dialog defaults', () => {
    test('use the channel quality over the global one', async () => {
      await renderWithTabsLoaded({ channelVideoQuality: '720' });

      expect(dialogs()).toHaveAttribute('data-default-resolution', '720');
      expect(dialogs()).toHaveAttribute('data-default-resolution-source', 'channel');
    });

    test('use the global quality when the channel sets none', async () => {
      mockUseConfig.mockReturnValue({ config: { preferredResolution: '480' } });

      await renderWithTabsLoaded({ channelVideoQuality: null });

      expect(dialogs()).toHaveAttribute('data-default-resolution', '480');
      expect(dialogs()).toHaveAttribute('data-default-resolution-source', 'global');
    });

    test('fall back to 1080 when neither sets a quality', async () => {
      mockUseConfig.mockReturnValue({ config: {} });

      await renderWithTabsLoaded();

      expect(dialogs()).toHaveAttribute('data-default-resolution', '1080');
      expect(dialogs()).toHaveAttribute('data-default-resolution-source', 'global');
    });

    test('use the channel audio format when it sets one', async () => {
      await renderWithTabsLoaded({ channelAudioFormat: 'mp3_only' });

      expect(dialogs()).toHaveAttribute('data-default-audio-format', 'mp3_only');
      expect(dialogs()).toHaveAttribute('data-default-audio-format-source', 'channel');
    });

    test('have no audio format when the channel sets none', async () => {
      await renderWithTabsLoaded();

      expect(dialogs()).toHaveAttribute('data-default-audio-format', 'null');
      expect(dialogs()).toHaveAttribute('data-default-audio-format-source', 'global');
    });

    test('hand the protect manual downloads setting to both download dialogs', async () => {
      mockUseConfig.mockReturnValue({ config: { preferredResolution: '1080', protectManualDownloads: true } });

      await renderWithTabsLoaded();

      expect(dialogs()).toHaveAttribute('data-default-protect', 'true');
      expect(screen.getByTestId('download-all-dialog')).toHaveAttribute('data-default-protect', 'true');
    });
  });

  describe('Background refresh', () => {
    const found = (newVideos: number, failed = false): Completion => ({
      lastResult: { type: 'autoRefresh', newVideos, failed, finishedAt: '2026-11-13T12:00:00.000Z' },
    });

    // What the videos hook hands back; a test replaces it to stand for a reload.
    let listedVideos: ChannelVideo[] = mockVideos;
    let listedTotal = mockVideos.length;

    // Only the Videos tab reports a background refresh, so a tab switch leaves it behind.
    const stubVideos = (refreshingTab: string | null = 'videos') => {
      mockUseChannelVideos.mockImplementation(({ tabType }: { tabType: string | null }) =>
        listed(listedVideos, {
          totalCount: listedTotal,
          refreshSeq: refreshingTab !== null && tabType === refreshingTab ? 1 : null,
        })
      );
    };

    const renderTracked = async (props = {}) => {
      renderChannelVideos(props);
      await waitFor(() => expect(mockTrackRefresh).toHaveBeenCalledTimes(1));
    };

    beforeEach(() => {
      listedVideos = mockVideos;
      listedTotal = mockVideos.length;
      stubFetchStatus();
      stubVideos();
      serverTabsAre(['videos', 'shorts']);
    });

    test('shows the checking status while a background refresh runs', async () => {
      await renderTracked();

      expect(screen.getByRole('status')).toHaveTextContent('Checking for new videos');
    });

    test('shows the new videos bar when the refresh found videos', async () => {
      await renderTracked();

      act(() => completeFetch(found(2)));

      expect(screen.getByText('2 new videos')).toBeInTheDocument();
      expect(screen.queryByText('Checking for new videos')).not.toBeInTheDocument();
    });

    test('shows no bar when the refresh found nothing', async () => {
      await renderTracked();

      act(() => completeFetch(found(0)));

      expect(screen.queryByRole('button', { name: 'Show' })).not.toBeInTheDocument();
      expect(screen.queryByText('Checking for new videos')).not.toBeInTheDocument();
    });

    test('does not refetch the list when a background refresh ends', async () => {
      await renderTracked();
      mockRefetchVideos.mockClear();

      act(() => completeFetch(found(2)));

      expect(mockRefetchVideos).not.toHaveBeenCalled();
    });

    test('does not refetch when a tracked refresh ends without a result', async () => {
      await renderTracked();
      mockRefetchVideos.mockClear();

      act(() => completeFetch({ lastResult: null }));

      expect(mockRefetchVideos).not.toHaveBeenCalled();
      expect(screen.queryByText('Checking for new videos')).not.toBeInTheDocument();
    });

    test('Show reloads the first page and removes the bar', async () => {
      await renderTracked();
      act(() => completeFetch(found(2)));
      mockRefetchVideos.mockClear();

      await userEvent.click(screen.getByRole('button', { name: 'Show' }));

      expect(mockRefetchVideos).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('2 new videos')).not.toBeInTheDocument();
    });

    test('Show returns to the first page from a later one', async () => {
      listedTotal = 48; // three pages at the default size of 16
      await renderTracked();
      await userEvent.click(screen.getAllByRole('button', { name: 'go to page 2' })[0]);
      act(() => completeFetch(found(2)));
      mockRefetchVideos.mockClear();

      await userEvent.click(screen.getByRole('button', { name: 'Show' }));

      expect(lastVideosQuery().page).toBe(1);
      expect(mockRefetchVideos).not.toHaveBeenCalled();
    });

    test('dismissing the bar removes it and leaves the list alone', async () => {
      await renderTracked();
      act(() => completeFetch(found(2)));
      mockRefetchVideos.mockClear();

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(screen.queryByText('2 new videos')).not.toBeInTheDocument();
      expect(mockRefetchVideos).not.toHaveBeenCalled();
    });

    describe('scrolling on Show', () => {
      const scrollIntoView = jest.fn();
      const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
      const listTopAt = (top: number) => {
        jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
          top, bottom: top, left: 0, right: 0, x: 0, y: top, width: 0, height: 0, toJSON: () => ({}),
        });
      };

      beforeEach(() => {
        scrollIntoView.mockClear();
        HTMLElement.prototype.scrollIntoView = scrollIntoView;
      });

      afterEach(() => {
        HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
        jest.restoreAllMocks();
      });

      test('leaves the page where it is when the top of the list is on screen', async () => {
        await renderTracked();
        act(() => completeFetch(found(2)));
        listTopAt(240);

        await userEvent.click(screen.getByRole('button', { name: 'Show' }));

        expect(scrollIntoView).not.toHaveBeenCalled();
      });

      test('brings the top of the list back when it has scrolled out of view', async () => {
        await renderTracked();
        act(() => completeFetch(found(2)));
        listTopAt(-3200);

        await userEvent.click(screen.getByRole('button', { name: 'Show' }));

        expect(scrollIntoView).toHaveBeenCalledTimes(1);
      });
    });

    test('still refetches when a Load More fetch ends', async () => {
      stubVideos(null);
      renderChannelVideos();
      await screen.findByRole('tab', { name: /Videos/i });
      mockRefetchVideos.mockClear();

      act(() => completeFetch({ lastResult: null }));

      expect(mockRefetchVideos).toHaveBeenCalledTimes(1);
    });

    test('drops the bar when the first page reloads for another reason', async () => {
      // A download broadcast, a delete or a rating change reloads the list:
      // the new rows are then on screen, so the offer has nothing left to show.
      let reloadList: () => void = () => {};
      const Harness = () => {
        const [reloads, setReloads] = useState(0);
        reloadList = () => {
          listedVideos = [...mockVideos];
          setReloads((count) => count + 1);
        };
        return <ChannelVideos token={mockToken} channelName={`Channel ${reloads}`} />;
      };
      renderWithProviders(<Harness />, { websocketValue: createMockWebSocketContext() });
      await waitFor(() => expect(mockTrackRefresh).toHaveBeenCalledTimes(1));
      act(() => completeFetch(found(2)));

      act(() => reloadList());

      expect(screen.queryByText('2 new videos')).not.toBeInTheDocument();
    });

    test('drops the bar on a tab switch', async () => {
      await renderTracked();
      act(() => completeFetch(found(2)));

      await userEvent.click(await screen.findByRole('tab', { name: /Shorts/i }));

      expect(screen.queryByText('2 new videos')).not.toBeInTheDocument();
    });

    test('drops the checking status on a tab switch', async () => {
      await renderTracked();

      await userEvent.click(await screen.findByRole('tab', { name: /Shorts/i }));

      expect(screen.queryByText('Checking for new videos')).not.toBeInTheDocument();
    });

    test('tells the parent when a background refresh succeeds', async () => {
      const onVideosLoaded = jest.fn();
      await renderTracked({ onVideosLoaded });

      act(() => completeFetch(found(0)));

      expect(onVideosLoaded).toHaveBeenCalledWith('UC123456');
    });

    test('does not tell the parent when the refresh failed', async () => {
      const onVideosLoaded = jest.fn();
      await renderTracked({ onVideosLoaded });

      act(() => completeFetch(found(0, true)));

      expect(onVideosLoaded).not.toHaveBeenCalled();
    });

    test('keeps the Load More label during a background refresh', async () => {
      stubFetchStatus({ isFetching: true, fetchType: 'autoRefresh' });
      await renderTracked();

      const loadMore = screen.getByTestId('channel-refresh-button');
      expect(loadMore).toHaveTextContent('Load More');
      expect(loadMore).toBeDisabled();
    });

    test('says Loading on the Load More button while a Load More fetch runs', async () => {
      stubFetchStatus({ isFetching: true, fetchType: 'fetchAll' });
      stubVideos(null);
      renderChannelVideos();

      expect(await screen.findByTestId('channel-refresh-button')).toHaveTextContent('Loading...');
    });
  });
});
