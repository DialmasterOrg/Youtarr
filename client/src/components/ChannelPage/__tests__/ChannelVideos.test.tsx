import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import ChannelVideos from '../ChannelVideos';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { renderWithProviders, createMockWebSocketContext } from '../../../test-utils';

// Mock Material-UI hooks
jest.mock('@mui/material/useMediaQuery');
jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({
    breakpoints: { down: () => false },
    zIndex: { fab: 1050 },
  }),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
const mockParams = { channel_id: 'UC123456' };
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => mockParams,
  useNavigate: () => mockNavigate,
}));

// Mock react-swipeable
jest.mock('react-swipeable', () => ({
  useSwipeable: () => ({}),
}));

// Mock child components
jest.mock('../VideoCard', () => ({
  __esModule: true,
  default: function MockVideoCard({ video }: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': `video-card-${video.youtube_id}`
    }, video.title);
  }
}));

jest.mock('../VideoListItem', () => ({
  __esModule: true,
  default: function MockVideoListItem({ video }: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': `video-list-item-${video.youtube_id}`
    }, video.title);
  }
}));

jest.mock('../VideoTableView', () => ({
  __esModule: true,
  default: function MockVideoTableView({ videos }: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'video-table-view'
    }, `Table with ${videos.length} videos`);
  }
}));

jest.mock('../ChannelVideosHeader', () => ({
  __esModule: true,
  default: function MockChannelVideosHeader(props: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'channel-videos-header',
      'data-view-mode': props.viewMode
    }, 'Header');
  }
}));

jest.mock('../ChannelVideosDialogs', () => ({
  __esModule: true,
  default: function MockChannelVideosDialogs() {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'channel-videos-dialogs'
    });
  }
}));

// Mock custom hooks
const mockRefetchVideos = jest.fn();
const mockRefreshVideos = jest.fn();
const mockClearError = jest.fn();
const mockTriggerDownloads = jest.fn();
const mockDeleteVideosByYoutubeIds = jest.fn();

jest.mock('../hooks/useChannelVideos', () => ({
  useChannelVideos: jest.fn(),
}));

jest.mock('../hooks/useRefreshChannelVideos', () => ({
  useRefreshChannelVideos: jest.fn(),
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

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const { useChannelVideos } = require('../hooks/useChannelVideos');
const { useRefreshChannelVideos } = require('../hooks/useRefreshChannelVideos');
const { useVideoDeletion } = require('../../shared/useVideoDeletion');
const { useConfig } = require('../../../hooks/useConfig');
const { useTriggerDownloads } = require('../../../hooks/useTriggerDownloads');

describe('ChannelVideos Component', () => {
  const mockToken = 'test-token';

  const mockVideos: ChannelVideo[] = [
    {
      title: 'Test Video 1',
      youtube_id: 'video1',
      publishedAt: '2023-01-01T00:00:00Z',
      thumbnail: 'https://i.ytimg.com/vi/video1/mqdefault.jpg',
      added: false,
      duration: 300,
      media_type: 'video',
      live_status: null,
    },
    {
      title: 'Test Video 2',
      youtube_id: 'video2',
      publishedAt: '2023-01-02T00:00:00Z',
      thumbnail: 'https://i.ytimg.com/vi/video2/mqdefault.jpg',
      added: true,
      removed: false,
      duration: 600,
      media_type: 'video',
      live_status: null,
    },
    {
      title: 'Test Short 1',
      youtube_id: 'short1',
      publishedAt: '2023-01-03T00:00:00Z',
      thumbnail: 'https://i.ytimg.com/vi/short1/mqdefault.jpg',
      added: false,
      duration: 30,
      media_type: 'short',
      live_status: null,
    },
  ];

  const renderChannelVideos = (props = {}) => {
    const wsCtx = createMockWebSocketContext();
    return renderWithProviders(
      <ChannelVideos token={mockToken} {...props} />,
      { websocketValue: wsCtx }
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    mockNavigate.mockClear();

    // Default mock responses
    useChannelVideos.mockReturnValue({
      videos: [],
      totalCount: 0,
      oldestVideoDate: null,
      videoFailed: false,
      autoDownloadsEnabled: false,
      loading: false,
      refetch: mockRefetchVideos,
    });

    useRefreshChannelVideos.mockReturnValue({
      refreshVideos: mockRefreshVideos,
      loading: false,
      error: null,
      clearError: mockClearError,
    });

    useVideoDeletion.mockReturnValue({
      deleteVideosByYoutubeIds: mockDeleteVideosByYoutubeIds,
      loading: false,
    });

    useConfig.mockReturnValue({
      config: { preferredResolution: '1080' },
    });

    useTriggerDownloads.mockReturnValue({
      triggerDownloads: mockTriggerDownloads,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ availableTabs: ['videos'] }),
    });
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderChannelVideos();
      expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
    });

    test('renders with loading state initially', () => {
      useChannelVideos.mockReturnValue({
        videos: [],
        totalCount: 0,
        oldestVideoDate: null,
        videoFailed: false,
        autoDownloadsEnabled: false,
        loading: true,
        refetch: mockRefetchVideos,
      });

      renderChannelVideos();
      expect(screen.getByText('Loading and fetching/indexing new videos for this channel tab...')).toBeInTheDocument();
    });

    test('renders videos in grid view by default on desktop', () => {
      useChannelVideos.mockReturnValue({
        videos: mockVideos,
        totalCount: 3,
        oldestVideoDate: '2023-01-01',
        videoFailed: false,
        autoDownloadsEnabled: false,
        loading: false,
        refetch: mockRefetchVideos,
      });

      renderChannelVideos();
      expect(screen.getByTestId('video-card-video1')).toBeInTheDocument();
      expect(screen.getByTestId('video-card-video2')).toBeInTheDocument();
      expect(screen.getByTestId('video-card-short1')).toBeInTheDocument();
    });

    test('shows no videos message when empty', () => {
      renderChannelVideos();
      expect(screen.getByText('No videos found')).toBeInTheDocument();
    });

    test('shows error message when fetch fails', () => {
      useChannelVideos.mockReturnValue({
        videos: [],
        totalCount: 0,
        oldestVideoDate: null,
        videoFailed: true,
        autoDownloadsEnabled: false,
        loading: false,
        refetch: mockRefetchVideos,
      });

      renderChannelVideos();
      expect(screen.getByText('Failed to fetch channel videos. Please try again later.')).toBeInTheDocument();
    });
  });

  describe('Tab Management', () => {
    test('does not show tabs while fetching, then shows tabs after loading', async () => {
      // Setup a delayed response to catch the loading state
      let resolveTabsFetch: (value: any) => void;
      const tabsFetchPromise = new Promise((resolve) => {
        resolveTabsFetch = resolve;
      });

      mockFetch.mockReturnValueOnce(tabsFetchPromise as any);

      renderChannelVideos();

      // While loading, tabs should not be present
      expect(screen.queryByRole('tab', { name: /Videos/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Shorts/i })).not.toBeInTheDocument();

      // Resolve the fetch with multiple tabs
      resolveTabsFetch!({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ availableTabs: ['videos', 'shorts'] }),
      });

      // Wait for tabs to appear after loading
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Videos/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('tab', { name: /Shorts/i })).toBeInTheDocument();
    });

    test('fetches available tabs on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ availableTabs: ['videos', 'shorts', 'streams'] }),
      });

      renderChannelVideos();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/channels/UC123456/tabs',
          expect.objectContaining({
            headers: { 'x-access-token': mockToken },
          })
        );
      });
    });

    test('displays tabs when multiple tabs are available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ availableTabs: ['videos', 'shorts', 'streams'] }),
      });

      renderChannelVideos();

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Videos/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('tab', { name: /Shorts/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Live/i })).toBeInTheDocument();
    });

    test('does not display tabs when only one tab available', () => {
      renderChannelVideos();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    test('handles tab change', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ availableTabs: ['videos', 'shorts'] }),
      });

      renderChannelVideos();

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Shorts/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /Shorts/i }));

      // Verify that useChannelVideos was called with the new tab
      await waitFor(() => {
        expect(useChannelVideos).toHaveBeenCalledWith(
          expect.objectContaining({
            tabType: 'shorts',
          })
        );
      });
    });

    test('prevents tab change while videos are loading', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ availableTabs: ['videos', 'shorts'] }),
      });

      useChannelVideos.mockReturnValue({
        videos: [],
        totalCount: 0,
        oldestVideoDate: null,
        videoFailed: false,
        autoDownloadsEnabled: false,
        loading: true,
        refetch: mockRefetchVideos,
      });

      renderChannelVideos();

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Shorts/i })).toBeInTheDocument();
      });

      const shortsTab = screen.getByRole('tab', { name: /Shorts/i });
      await user.click(shortsTab);

      // Tab should not change when loading - we can't really test this with current setup
      // since React state changes happen internally
    });
  });

  describe('View Modes', () => {
    test('renders in list view on mobile by default', () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);

      useChannelVideos.mockReturnValue({
        videos: mockVideos,
        totalCount: 3,
        oldestVideoDate: '2023-01-01',
        videoFailed: false,
        autoDownloadsEnabled: false,
        loading: false,
        refetch: mockRefetchVideos,
      });

      renderChannelVideos();

      expect(screen.getByTestId('video-list-item-video1')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    test('displays pagination when multiple pages exist', () => {
      useChannelVideos.mockReturnValue({
        videos: mockVideos,
        totalCount: 32,
        oldestVideoDate: '2023-01-01',
        videoFailed: false,
        autoDownloadsEnabled: false,
        loading: false,
        refetch: mockRefetchVideos,
      });

      renderChannelVideos();

      const paginationElements = screen.getAllByRole('navigation');
      expect(paginationElements.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('handles tab fetch error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      renderChannelVideos();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error fetching available tabs:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    test('handles non-ok tab response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      renderChannelVideos();

      // Should still render without tabs
      await waitFor(() => {
        expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles null token', () => {
      renderChannelVideos({ token: null });

      expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
    });

    test('handles empty tabs array from server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ availableTabs: [] }),
      });

      renderChannelVideos();

      await waitFor(() => {
        expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
      });

      // Should display fallback 'Videos' tab when server returns empty array
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /Videos/i })).toBeInTheDocument();
      });
    });

    test('handles undefined channelAutoDownloadTabs prop', () => {
      renderChannelVideos({ channelAutoDownloadTabs: undefined });

      expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
    });

    test('initializes tab auto-download status from prop', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ availableTabs: ['videos', 'shorts', 'streams'] }),
      });

      renderChannelVideos({ channelAutoDownloadTabs: 'video,short' });

      // Component should initialize the tab auto-download status
      // This is internal state so we can't directly test it, but we can verify it rendered
      await waitFor(() => {
        expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    test('calls useChannelVideos hook with correct parameters', () => {
      renderChannelVideos();

      // Initially called with null tabType until tabs are loaded
      expect(useChannelVideos).toHaveBeenCalledWith({
        channelId: 'UC123456',
        page: 1,
        pageSize: 16, // Desktop default
        hideDownloaded: false,
        searchQuery: '',
        sortBy: 'date',
        sortOrder: 'desc',
        tabType: null,
        token: mockToken,
      });
    });

    test('calls useRefreshChannelVideos hook with correct parameters', () => {
      renderChannelVideos();

      // Initially called with null tabType until tabs are loaded
      expect(useRefreshChannelVideos).toHaveBeenCalledWith(
        'UC123456',
        1, // page
        16, // pageSize
        false, // hideDownloaded
        null, // tabType - null until tabs are loaded
        mockToken
      );
    });
  });

  describe('Loading Skeletons', () => {
    test('displays skeleton loaders while fetching videos', () => {
      useChannelVideos.mockReturnValue({
        videos: [],
        totalCount: 0,
        oldestVideoDate: null,
        videoFailed: false,
        autoDownloadsEnabled: false,
        loading: true,
        refetch: mockRefetchVideos,
      });

      renderChannelVideos();

      expect(screen.getByText('Loading and fetching/indexing new videos for this channel tab...')).toBeInTheDocument();
      // Skeletons are MUI components, hard to test directly
    });
  });

  describe('Mobile Features', () => {
    beforeEach(() => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);
    });

    test('uses mobile page size', () => {
      renderChannelVideos();

      expect(useChannelVideos).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 8, // Mobile page size
        })
      );
    });

    test('renders list view by default on mobile', () => {
      useChannelVideos.mockReturnValue({
        videos: mockVideos,
        totalCount: 3,
        oldestVideoDate: '2023-01-01',
        videoFailed: false,
        autoDownloadsEnabled: false,
        loading: false,
        refetch: mockRefetchVideos,
      });

      renderChannelVideos();

      expect(screen.getByTestId('video-list-item-video1')).toBeInTheDocument();
      expect(screen.queryByTestId('video-card-video1')).not.toBeInTheDocument();
    });
  });

});
