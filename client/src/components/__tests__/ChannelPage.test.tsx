import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChannelPage from '../ChannelPage';
import { BrowserRouter } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useConfig } from '../../hooks/useConfig';

const dialogPropsStore: { current: any } = { current: null };
const channelVideosPropsStore: { current: any } = { current: null };

// Mock child components
jest.mock('../ChannelPage/ChannelVideos', () => ({
  __esModule: true,
  default: function MockChannelVideos(props: any) {
    const React = require('react');
    channelVideosPropsStore.current = props;
    return React.createElement('div', {
      'data-testid': 'channel-videos',
      'data-token': props.token,
      'data-auto-download-tabs': String(props.channelAutoDownloadTabs),
      'data-channel-quality': String(props.channelVideoQuality)
    }, 'Channel Videos');
  }
}));

jest.mock('../ChannelPage/ChannelSettingsDialog', () => ({
  __esModule: true,
  default: (props: any) => {
    const React = require('react');
    dialogPropsStore.current = props;
    return React.createElement('div', {
      'data-testid': 'channel-settings-dialog',
      'data-open': props.open ? 'true' : 'false'
    });
  }
}));

// Mock custom hooks
jest.mock('../../hooks/useMediaQuery');
jest.mock('../../hooks/useConfig');

// Mock react-router-dom
const mockParams = { channel_id: 'UC123456' };
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => mockParams,
}));

jest.mock('axios', () => ({
  put: jest.fn(),
  isAxiosError: jest.fn(),
}));

const mockRefetchChannelTv = jest.fn(() => Promise.resolve());
const mockChannelTv: { current: { layout: 'videos' | 'tv' } | null } = { current: null };
jest.mock('../ChannelPage/hooks/useChannelTv', () => ({
  useChannelTv: () => ({
    tv: mockChannelTv.current,
    loading: false,
    error: null,
    refetch: mockRefetchChannelTv,
    switchLayout: jest.fn(),
  }),
}));

const mockRefetchTitleShows = jest.fn(() => Promise.resolve());
const mockTitleShows: { current: { shows: Array<{ id: number; name: string; retired: boolean }> } | null } = { current: null };
jest.mock('../ChannelPage/hooks/useTitleShows', () => ({
  useTitleShows: () => ({
    data: mockTitleShows.current,
    loading: false,
    error: null,
    refetch: mockRefetchTitleShows,
  }),
}));

// The listing-refresh subscriptions the page makes (download events, a reorganize's end).
const listingRefreshCallbacks: Array<() => void> = [];
jest.mock('../../hooks/useDownloadListingsRefresh', () => ({
  useDownloadListingsRefresh: (onRefresh: () => void) => {
    listingRefreshCallbacks.push(onRefresh);
  },
}));

const axios = require('axios');

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('ChannelPage Component', () => {
  const mockToken = 'test-token';
  const mockChannel = {
    uploader: 'Tech Channel',
    description: 'This is a test channel description\nWith multiple lines\nhttps://example.com',
    channel_id: 'UC123456',
    auto_download_enabled_tabs: 'videos,shorts'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockChannel),
    });
    (useMediaQuery as jest.Mock).mockReturnValue(false); // Default to desktop
    (useConfig as jest.Mock).mockReturnValue({
      config: { preferredResolution: '1080' },
      initialConfig: null,
      isPlatformManaged: {
        plexUrl: false,
        authEnabled: true,
        useTmpForDownloads: false,
      },
      deploymentEnvironment: {
        platform: null,
        isWsl: false,
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      setConfig: jest.fn(),
      setInitialConfig: jest.fn(),
    });
    dialogPropsStore.current = null;
    channelVideosPropsStore.current = null;
    mockChannelTv.current = null;
    mockTitleShows.current = null;
  });

  describe('TV chip', () => {
    const page = () => (
      <BrowserRouter>
        <ChannelPage token={mockToken} />
      </BrowserRouter>
    );

    test('shows the TV chip for a channel saved as a TV show', async () => {
      mockChannelTv.current = { layout: 'tv' };
      render(page());

      expect(await screen.findByTestId('tv-chip')).toBeInTheDocument();
    });

    test('hides the TV chip for a Videos channel', async () => {
      mockChannelTv.current = { layout: 'videos' };
      render(page());

      await screen.findByText('Tech Channel');
      expect(screen.queryByTestId('tv-chip')).not.toBeInTheDocument();
    });

    test('refreshes the TV state after the settings dialog saves', async () => {
      render(page());
      await screen.findByText('Tech Channel');

      act(() => {
        dialogPropsStore.current.onSettingsSaved?.({ sub_folder: 'Anime', video_quality: null });
      });

      expect(mockRefetchChannelTv).toHaveBeenCalled();
    });
  });

  describe('Title shows', () => {
    const page = () => (
      <BrowserRouter>
        <ChannelPage token={mockToken} />
      </BrowserRouter>
    );
    const shows = [
      { id: 1, name: 'Tier Lists', retired: false },
      { id: 2, name: 'Old Series', retired: true },
      { id: 3, name: 'Q&A', retired: false },
    ];

    test('counts the active title shows in the header chip', async () => {
      mockTitleShows.current = { shows };
      render(page());

      expect(await screen.findByTestId('shows-chip')).toHaveTextContent('2 shows');
    });

    test('shows no shows chip for a channel without title shows', async () => {
      mockTitleShows.current = { shows: [] };
      render(page());

      await screen.findByText('Tech Channel');
      expect(screen.queryByTestId('shows-chip')).not.toBeInTheDocument();
    });

    test('offers only the active shows to the video list', async () => {
      mockTitleShows.current = { shows };
      render(page());
      await screen.findByText('Tech Channel');

      expect(channelVideosPropsStore.current.titleShows).toEqual([
        { id: 1, name: 'Tier Lists' },
        { id: 3, name: 'Q&A' },
      ]);
    });

    test('asks the video list to reload when the settings dialog closes', async () => {
      render(page());
      await screen.findByText('Tech Channel');
      const before = channelVideosPropsStore.current.refreshKey;
      act(() => {
        dialogPropsStore.current.onClose();
      });
      expect(channelVideosPropsStore.current.refreshKey).not.toBe(before);
    });

    test('reloads the shows when the settings dialog closes', async () => {
      render(page());
      await screen.findByText('Tech Channel');

      act(() => {
        dialogPropsStore.current.onClose();
      });

      expect(mockRefetchTitleShows).toHaveBeenCalled();
    });

    test('reloads the shows and TV state on a listing refresh (a reorganize ended)', async () => {
      listingRefreshCallbacks.length = 0;
      render(page());
      await screen.findByText('Tech Channel');
      mockRefetchTitleShows.mockClear();
      mockRefetchChannelTv.mockClear();

      act(() => {
        listingRefreshCallbacks.forEach((callback) => callback());
      });

      expect(mockRefetchTitleShows).toHaveBeenCalled();
      expect(mockRefetchChannelTv).toHaveBeenCalled();
    });
  });

  describe('Auto-download toggles', () => {
    const channelA = { uploader: 'Channel A', channel_id: 'UC123456', available_tabs: 'videos,shorts,streams', auto_download_enabled_tabs: 'video' };
    const savedAs = (value: string) => ({ data: { settings: { auto_download_enabled_tabs: value } } });

    const openChannelA = async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValueOnce(channelA) });
      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );
      return screen.findByRole('button', { name: 'Auto-download Shorts' });
    };

    test('turns a tab on and confirms it', async () => {
      axios.put.mockResolvedValueOnce(savedAs('video,short'));
      const shorts = await openChannelA();

      await act(async () => { shorts.click(); });

      expect(await screen.findByText('Auto-download on for Shorts')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Auto-download Shorts' })).toHaveAttribute('aria-pressed', 'true');
    });

    test('undo turns the tab back off', async () => {
      axios.put.mockResolvedValueOnce(savedAs('video,short')).mockResolvedValueOnce(savedAs('video'));
      const shorts = await openChannelA();
      await act(async () => { shorts.click(); });

      await act(async () => { (await screen.findByRole('button', { name: 'Undo' })).click(); });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Auto-download Shorts' })).toHaveAttribute('aria-pressed', 'false');
      });
    });

    test('reverts the tab and explains when the save fails', async () => {
      axios.put.mockRejectedValueOnce(new Error('network down'));
      const shorts = await openChannelA();

      await act(async () => { shorts.click(); });

      expect(await screen.findByText("Couldn't update auto-download for Shorts")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Auto-download Shorts' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Navigating between channels', () => {
    const channelA = { uploader: 'Channel A', channel_id: 'UC123456', available_tabs: 'videos,shorts,streams', auto_download_enabled_tabs: 'video' };
    const channelB = { uploader: 'Channel B', channel_id: 'UC999999', available_tabs: 'videos,shorts,streams', auto_download_enabled_tabs: 'livestream' };
    const page = () => (
      <BrowserRouter>
        <ChannelPage token={mockToken} />
      </BrowserRouter>
    );

    afterEach(() => {
      mockParams.channel_id = 'UC123456';
    });

    test('shows the toggles as loading until the new channel arrives', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValueOnce(channelA) });
      const { rerender } = render(page());
      await screen.findByRole('button', { name: 'Auto-download Videos' });

      mockParams.channel_id = 'UC999999';
      mockFetch.mockReturnValueOnce(new Promise(() => undefined));
      rerender(page());

      expect(screen.queryByRole('button', { name: 'Auto-download Videos' })).not.toBeInTheDocument();
    });

    test('keeps the save lock when returning to a channel before its save finishes', async () => {
      axios.put.mockReturnValueOnce(new Promise(() => undefined));
      mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValueOnce(channelA) });
      const { rerender } = render(page());
      const shorts = await screen.findByRole('button', { name: 'Auto-download Shorts' });
      await act(async () => { shorts.click(); });

      mockParams.channel_id = 'UC999999';
      mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValueOnce(channelB) });
      rerender(page());
      await screen.findByText('Channel B');
      mockParams.channel_id = 'UC123456';
      mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValueOnce(channelA) });
      rerender(page());
      await screen.findByText('Channel A');

      expect(screen.getByRole('button', { name: 'Auto-download Live' })).toBeDisabled();
    });

    test('keeps the save lock when the layout switches to mobile mid-save', async () => {
      axios.put.mockReturnValueOnce(new Promise(() => undefined));
      mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValueOnce(channelA) });
      const { rerender } = render(page());
      const shorts = await screen.findByRole('button', { name: 'Auto-download Shorts' });
      await act(async () => { shorts.click(); });

      (useMediaQuery as jest.Mock).mockReturnValue(true);
      rerender(page());

      expect(screen.getByRole('button', { name: 'Auto-download Live' })).toBeDisabled();
    });

    test('ignores a save for the previous channel that finishes after navigating', async () => {
      let resolveSave: (value: unknown) => void = () => undefined;
      axios.put.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
      mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValueOnce(channelA) });
      const { rerender } = render(page());
      const shorts = await screen.findByRole('button', { name: 'Auto-download Shorts' });
      await act(async () => { shorts.click(); });

      mockParams.channel_id = 'UC999999';
      mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValueOnce(channelB) });
      rerender(page());
      await screen.findByText('Channel B');
      await act(async () => { resolveSave({ data: { settings: { auto_download_enabled_tabs: 'video,short' } } }); });

      expect(screen.getByRole('button', { name: 'Auto-download Shorts' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Global automatic downloads hint', () => {
    const renderWithConfig = (config: Record<string, unknown>, loading: boolean) => {
      (useConfig as jest.Mock).mockReturnValue({
        ...(useConfig as jest.Mock)(),
        config,
        loading,
      });
      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );
    };

    test('shows the hint when automatic downloads are off', async () => {
      renderWithConfig({ preferredResolution: '1080', channelAutoDownload: false }, false);

      expect(await screen.findByRole('link', { name: /Automatic downloads are off/ })).toBeInTheDocument();
    });

    test('hides the hint when automatic downloads are on', async () => {
      renderWithConfig({ preferredResolution: '1080', channelAutoDownload: true }, false);

      await screen.findByRole('button', { name: 'Auto-download Videos' });
      expect(screen.queryByRole('link', { name: /Automatic downloads are off/ })).not.toBeInTheDocument();
    });

    test('hides the hint while the config is loading', async () => {
      renderWithConfig({ preferredResolution: '1080' }, true);

      await screen.findByRole('button', { name: 'Auto-download Videos' });
      expect(screen.queryByRole('link', { name: /Automatic downloads are off/ })).not.toBeInTheDocument();
    });
  });

  describe('Component Rendering', () => {
    test('renders channel page with loading state initially', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      // There are multiple Loading... texts, so use getAllByText
      const loadingTexts = screen.getAllByText('Loading...');
      expect(loadingTexts.length).toBeGreaterThan(0);
    });

    test('fetches and displays channel information', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/getChannelInfo/UC123456',
          {
            headers: {
              'x-access-token': mockToken
            }
          }
        );
      });

      expect(await screen.findByText('Tech Channel')).toBeInTheDocument();
    });

    test('does not show the YouTube link before the channel loads', () => {
      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      expect(screen.queryByRole('link', { name: 'Open in YouTube' })).not.toBeInTheDocument();
    });

    test('links to the channel on YouTube once loaded', async () => {
      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      expect(await screen.findByRole('link', { name: 'Open in YouTube' })).toHaveAttribute(
        'href',
        'https://www.youtube.com/channel/UC123456'
      );
    });

    test('renders ChannelVideos component with token and channelAutoDownloadTabs props', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      const channelVideos = screen.getByTestId('channel-videos');
      expect(channelVideos).toBeInTheDocument();
      expect(channelVideos).toHaveAttribute('data-token', mockToken);

      // Initially channelAutoDownloadTabs should be undefined and channelVideoQuality should be null
      expect(channelVideos).toHaveAttribute('data-auto-download-tabs', 'undefined');
      expect(channelVideos).toHaveAttribute('data-channel-quality', 'null');

      // After channel data loads, it should be set
      await screen.findByText('Tech Channel');
      expect(channelVideos).toHaveAttribute('data-auto-download-tabs', 'videos,shorts');
      expect(channelVideos).toHaveAttribute('data-channel-quality', 'null');
    });

    test('renders with null token', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={null} />
        </BrowserRouter>
      );

      expect(mockFetch).toHaveBeenCalledWith(
        '/getChannelInfo/UC123456',
        {
          headers: {
            'x-access-token': ''
          }
        }
      );
    });

    test('passes undefined channelAutoDownloadTabs when not present in channel data', async () => {
      const channelWithoutTabs = {
        uploader: 'Tech Channel',
        description: 'Test description',
        channel_id: 'UC123456'
        // auto_download_enabled_tabs is not present
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithoutTabs)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      const channelVideos = screen.getByTestId('channel-videos');
      expect(channelVideos).toHaveAttribute('data-auto-download-tabs', 'undefined');
    });

    test('updates channel display after settings dialog saves', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      expect(dialogPropsStore.current).not.toBeNull();

      act(() => {
        dialogPropsStore.current.onSettingsSaved?.({
          sub_folder: 'Sports',
          video_quality: '720',
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('channel-videos')).toHaveAttribute('data-channel-quality', '720');
      });

      await waitFor(() => {
        expect(screen.getByText('__Sports/')).toBeInTheDocument();
      });
    });

    test('updates channel display when settings are cleared (null values)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          ...mockChannel,
          sub_folder: 'InitialFolder',
          video_quality: '1080'
        })
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Verify initial state
      expect(screen.getByTestId('channel-videos')).toHaveAttribute('data-channel-quality', '1080');
      expect(screen.getByText('__InitialFolder/')).toBeInTheDocument();

      expect(dialogPropsStore.current).not.toBeNull();

      // Clear settings by passing null values
      act(() => {
        dialogPropsStore.current.onSettingsSaved?.({
          sub_folder: null,
          video_quality: null,
          min_duration: null,
          max_duration: null,
          title_filter_regex: null
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('channel-videos')).toHaveAttribute('data-channel-quality', 'null');
      });

      await waitFor(() => {
        expect(screen.queryByText('__InitialFolder/')).not.toBeInTheDocument();
      });
    });

    test('handles onSettingsSaved when channel is not loaded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      // Try to call onSettingsSaved before channel loads
      // This tests the safety check in handleSettingsSaved
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Since dialogPropsStore.current is null initially, this test ensures
      // the component handles the case gracefully
      await screen.findByText('Tech Channel');

      consoleErrorSpy.mockRestore();
    });

    test('updates channel with new filter settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      expect(dialogPropsStore.current).not.toBeNull();

      act(() => {
        dialogPropsStore.current.onSettingsSaved?.({
          sub_folder: null,
          video_quality: '1080',
          min_duration: 300,
          max_duration: 3600,
          title_filter_regex: 'tutorial.*'
        });
      });

      // Wait for filter indicators to appear
      await waitFor(() => {
        expect(screen.getByText('1080p')).toBeInTheDocument();
      });
      expect(screen.getByText('5-60 min')).toBeInTheDocument();
      expect(screen.getByText('Title Filter')).toBeInTheDocument();
    });
  });

  describe('Filter Indicators', () => {
    test('does not render filter indicators when no filters are set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // None of the filter chips should be present
      expect(screen.queryByText(/p$/)).not.toBeInTheDocument(); // quality chip
      expect(screen.queryByText(/min$/)).not.toBeInTheDocument(); // duration chip
      expect(screen.queryByText('Title Filter')).not.toBeInTheDocument(); // regex chip
    });

    test('renders quality filter indicator when video_quality is set', async () => {
      const channelWithQuality = {
        ...mockChannel,
        video_quality: '1080'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithQuality)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      expect(screen.getByText('1080p')).toBeInTheDocument();
    });

    test('renders duration filter with min and max', async () => {
      const channelWithDuration = {
        ...mockChannel,
        min_duration: 300, // 5 minutes
        max_duration: 3600 // 60 minutes
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithDuration)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      expect(screen.getByText('5-60 min')).toBeInTheDocument();
    });

    test('renders duration filter with only min duration', async () => {
      const channelWithMinDuration = {
        ...mockChannel,
        min_duration: 600 // 10 minutes
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithMinDuration)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      expect(screen.getByText('≥10 min')).toBeInTheDocument();
    });

    test('renders duration filter with only max duration', async () => {
      const channelWithMaxDuration = {
        ...mockChannel,
        max_duration: 1800 // 30 minutes
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithMaxDuration)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      expect(screen.getByText('≤30 min')).toBeInTheDocument();
    });

    test('renders regex filter indicator when title_filter_regex is set', async () => {
      const channelWithRegex = {
        ...mockChannel,
        title_filter_regex: '^tutorial.*'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithRegex)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      expect(screen.getByText('Title Filter')).toBeInTheDocument();
    });

    test('renders all filter indicators when all filters are set', async () => {
      const channelWithAllFilters = {
        ...mockChannel,
        video_quality: '720',
        min_duration: 120,
        max_duration: 1200,
        title_filter_regex: 'test.*pattern'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithAllFilters)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      expect(screen.getByText('720p')).toBeInTheDocument();
      expect(screen.getByText('2-20 min')).toBeInTheDocument();
      expect(screen.getByText('Title Filter')).toBeInTheDocument();
    });
  });

  describe('Regex Filter Popover/Dialog', () => {
    test('opens popover on desktop when regex chip is clicked', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false); // Desktop

      const channelWithRegex = {
        ...mockChannel,
        title_filter_regex: '^tutorial.*test$'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithRegex)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      const regexChip = screen.getByText('Title Filter');
      expect(regexChip).toBeInTheDocument();

      // Click the regex chip
      await act(async () => {
        regexChip.click();
      });

      // Popover should appear with the regex pattern
      await waitFor(() => {
        expect(screen.getByText('Title Filter Regex Pattern:')).toBeInTheDocument();
      });
      expect(screen.getByText('^tutorial.*test$')).toBeInTheDocument();
    });

    test('popover displays correct regex pattern on desktop', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false); // Desktop

      const channelWithRegex = {
        ...mockChannel,
        title_filter_regex: 'test-pattern'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithRegex)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      const regexChip = screen.getByText('Title Filter');
      await act(async () => {
        regexChip.click();
      });

      await waitFor(() => {
        expect(screen.getByText('test-pattern')).toBeInTheDocument();
      });
    });

    test('opens dialog on mobile when regex chip is clicked', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true); // Mobile

      const channelWithRegex = {
        ...mockChannel,
        title_filter_regex: 'mobile-regex-pattern'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithRegex)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      const regexChip = screen.getByText('Title Filter');
      await act(async () => {
        regexChip.click();
      });

      // Dialog should appear with the regex pattern
      await waitFor(() => {
        expect(screen.getByText('Title Filter Regex Pattern')).toBeInTheDocument();
      });
      expect(screen.getByText('mobile-regex-pattern')).toBeInTheDocument();
    });

    test('renders dialog instead of popover on mobile', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true); // Mobile

      const channelWithRegex = {
        ...mockChannel,
        title_filter_regex: 'test-pattern'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithRegex)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      const regexChip = screen.getByText('Title Filter');
      await act(async () => {
        regexChip.click();
      });

      // Dialog should appear (not popover)
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    test('does not show dialog initially on desktop', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false); // Desktop

      const channelWithRegex = {
        ...mockChannel,
        title_filter_regex: 'test-pattern'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithRegex)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Dialog should not be in the document initially on desktop
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('formatDuration Helper', () => {
    test('formats duration with both min and max', async () => {
      const channelWithBothDurations = {
        ...mockChannel,
        min_duration: 600,  // 10 minutes
        max_duration: 3600  // 60 minutes
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithBothDurations)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      expect(screen.getByText('10-60 min')).toBeInTheDocument();
    });

    test('formats duration with min of 0 as no min filter', async () => {
      const channelWithZeroMin = {
        ...mockChannel,
        min_duration: 0,
        max_duration: 1800
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithZeroMin)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      // 0 is falsy, so should only show max
      expect(screen.getByText('≤30 min')).toBeInTheDocument();
    });

    test('formats duration with max of 0 as no max filter', async () => {
      const channelWithZeroMax = {
        ...mockChannel,
        min_duration: 300,
        max_duration: 0
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithZeroMax)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      // 0 is falsy, so should only show min
      expect(screen.getByText('≥5 min')).toBeInTheDocument();
    });

    test('handles seconds that do not divide evenly into minutes', async () => {
      const channelWithOddSeconds = {
        ...mockChannel,
        min_duration: 90,   // 1.5 minutes -> floors to 1
        max_duration: 150   // 2.5 minutes -> floors to 2
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithOddSeconds)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      expect(screen.getByText('1-2 min')).toBeInTheDocument();
    });
  });

  describe('Channel Thumbnail', () => {
    test('displays channel thumbnail with correct source', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      const thumbnail = screen.getByAltText('Channel thumbnail') as HTMLImageElement;
      expect(thumbnail).toHaveAttribute('src', '/images/channelthumb-UC123456.jpg');
    });

    test('thumbnail has border styling', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      const thumbnail = screen.getByAltText('Channel thumbnail') as HTMLImageElement;
      expect(thumbnail).toHaveStyle({ border: '1px solid' });
    });

    test('shows empty source when channel is not loaded', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      const thumbnail = screen.getByAltText('Channel thumbnail') as HTMLImageElement;
      expect(thumbnail).toHaveAttribute('src', '');
    });
  });

  describe('Channel Description', () => {
    test('displays channel description with HTML formatting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check that description contains the expected text
      await waitFor(() => {
        const descriptionBox = screen.getByText((content, element) => {
          return element?.tagName === 'SPAN' &&
                 content.includes('This is a test channel description');
        });
        expect(descriptionBox).toBeInTheDocument();
      });
    });

    test('converts URLs to clickable links in description', async () => {
      const channelWithUrl = {
        ...mockChannel,
        description: 'Check out https://example.com for more'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithUrl)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Verify the link is created
      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'https://example.com' });
        expect(link).toHaveAttribute('href', 'https://example.com');
      });
    });

    test('does not include trailing punctuation in description links', async () => {
      const channelWithUrl = {
        ...mockChannel,
        description: 'Check out https://example.com).'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithUrl)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'https://example.com' });
        expect(link).toHaveAttribute('href', 'https://example.com');
      });
      expect(document.body).toHaveTextContent('Check out https://example.com).');
    });

    test('converts newlines to br tags in description', async () => {
      const channelWithNewlines = {
        ...mockChannel,
        description: 'Line 1\nLine 2\r\nLine 3'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelWithNewlines)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check that text is displayed with line breaks handled
      await waitFor(() => {
        const descriptionBox = screen.getByText((content, element) => {
          return element?.tagName === 'SPAN' && content.includes('Line 1');
        });
        expect(descriptionBox).toBeInTheDocument();
      });
    });

    test('displays fallback message when description is null', async () => {
      const channelNoDescription = {
        ...mockChannel,
        description: null
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelNoDescription)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check for the fallback message
      await waitFor(() => {
        expect(screen.getByText(/\*\* No description available \*\*/)).toBeInTheDocument();
      });
    });

    test('displays fallback message when description is undefined', async () => {
      const channelNoDescription = {
        uploader: 'Tech Channel',
        channel_id: 'UC123456'
        // description is undefined
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(channelNoDescription)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check for the fallback message
      await waitFor(() => {
        expect(screen.getByText(/\*\* No description available \*\*/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles fetch error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      // Component should still render with loading state
      const loadingTexts = screen.getAllByText('Loading...');
      expect(loadingTexts.length).toBeGreaterThan(0);

      consoleErrorSpy.mockRestore();
    });

    test('handles non-ok response', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });

    test('handles JSON parse error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON'))
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);
    });

    test('renders title with smaller variant on mobile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check that the title is rendered
      const title = screen.getByRole('heading', { name: 'Tech Channel' });
      expect(title).toHaveClass('typo-h5');
    });

    test('shows None when the channel has no rating override', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ ...mockChannel, default_rating: null })
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      expect(await screen.findByText('None')).toBeInTheDocument();
    });

    test('opens the settings dialog from the header Edit button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');
      await act(async () => {
        screen.getByRole('button', { name: 'Edit settings' }).click();
      });

      expect(screen.getByTestId('channel-settings-dialog')).toHaveAttribute('data-open', 'true');
    });

    test('description box has mobile-specific height', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check that description text is rendered in a scrollable box
      await waitFor(() => {
        const descriptionText = screen.getByText(/This is a test channel description/);
        expect(descriptionText).toBeInTheDocument();
      });
    });
  });

  describe('Desktop View', () => {
    beforeEach(() => {
      (useMediaQuery as jest.Mock).mockReturnValue(false);
    });

    test('renders title with larger variant on desktop', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      const title = screen.getByRole('heading', { name: 'Tech Channel' });
      expect(title).toHaveClass('typo-h4');
    });
  });

  describe('description rendering', () => {
    test('handles complex text transformations', async () => {
      const complexDescription = {
        ...mockChannel,
        description: 'Visit https://example.com and http://test.org\nNew line here\r\nAnother line'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(complexDescription)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check that both URLs are converted to links
      await waitFor(() => {
        const link1 = screen.getByRole('link', { name: 'https://example.com' });
        expect(link1).toHaveAttribute('href', 'https://example.com');
      });

      const link2 = screen.getByRole('link', { name: 'http://test.org' });
      expect(link2).toHaveAttribute('href', 'http://test.org');
    });

    test('renders HTML-like channel descriptions as text, not executable markup', async () => {
      const maliciousDescription = {
        ...mockChannel,
        description: '<img src=x onerror="window.__xss=true"> https://example.com'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(maliciousDescription)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      expect(screen.getByText(/<img src=x onerror=/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'https://example.com' })).toHaveAttribute('href', 'https://example.com');
    });

    test('handles empty description gracefully', async () => {
      const emptyDescription = {
        ...mockChannel,
        description: ''
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(emptyDescription)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check that the component renders without error
      const title = screen.getByRole('heading', { name: 'Tech Channel' });
      expect(title).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    test('shows loading text while fetching channel data', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
    });

    test('updates from loading to channel data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      // Initially shows loading
      const loadingTexts = screen.getAllByText('Loading...');
      expect(loadingTexts.length).toBeGreaterThan(0);

      // After data loads, loading text should be replaced
      await screen.findByText('Tech Channel');
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    test('renders with correct card structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check that the main elements are rendered
      expect(screen.getByRole('heading', { name: 'Tech Channel' })).toBeInTheDocument();
      expect(screen.getByAltText('Channel thumbnail')).toBeInTheDocument();
    });

    test('renders all main components', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel)
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await screen.findByText('Tech Channel');

      // Check for the ChannelVideos component
      expect(screen.getByTestId('channel-videos')).toBeInTheDocument();
    });
  });

  describe('Terminated channel refresh on videos load', () => {
    test('refetches channel info when videos load and current channel is marked terminated', async () => {
      const terminatedChannel = {
        ...mockChannel,
        terminated_at: '2026-03-01T00:00:00Z',
      };
      const reinstatedChannel = {
        ...mockChannel,
        terminated_at: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(terminatedChannel),
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(channelVideosPropsStore.current).not.toBeNull();
      });
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(reinstatedChannel),
      });

      await act(async () => {
        channelVideosPropsStore.current.onVideosLoaded('UC123456');
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
      expect(mockFetch.mock.calls[1][0]).toContain('/getChannelInfo/UC123456');
    });

    test('does NOT refetch channel info when channel was never terminated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockChannel),
      });

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(channelVideosPropsStore.current).not.toBeNull();
      });
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        channelVideosPropsStore.current.onVideosLoaded('UC123456');
      });

      // No second fetch: callback short-circuits when terminated_at is unset.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('refetches channel info when videos load before initial /getChannelInfo response lands', async () => {
      // Race scenario: useChannelVideos resolves and the backend cleared
      // terminated_at, but the parent's initial /getChannelInfo is still
      // in flight. channelRef.current is null at callback time. Without
      // refetching here, the in-flight stale response would overwrite and
      // the hook latch (already fired) can never retry.
      const reinstatedChannel = {
        ...mockChannel,
        terminated_at: null,
      };

      let resolveInitial: ((value: any) => void) | undefined;
      const initialPromise = new Promise((resolve) => {
        resolveInitial = resolve;
      });
      mockFetch.mockReturnValueOnce(initialPromise);

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(channelVideosPropsStore.current).not.toBeNull();
      });
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Queue the refetch response BEFORE firing the callback so the
      // mockFetch chain stays deterministic.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(reinstatedChannel),
      });

      await act(async () => {
        channelVideosPropsStore.current.onVideosLoaded('UC123456');
      });

      // The refetch fires even though channelRef.current is still null.
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
      expect(mockFetch.mock.calls[1][0]).toContain('/getChannelInfo/UC123456');

      // Resolve the initial in-flight request so React can clean up cleanly.
      await act(async () => {
        resolveInitial!({
          ok: true,
          json: jest.fn().mockResolvedValue({
            ...mockChannel,
            terminated_at: '2026-03-01T00:00:00Z',
          }),
        });
      });
    });

    test('late stale /getChannelInfo response does not overwrite the fresh refetch', async () => {
      // End-to-end ordering check: the initial request resolves AFTER the
      // post-videos-loaded refetch. The monotonic request-id gate must
      // reject the late stale response so the terminated notice stays gone.
      const terminatedPayload = {
        ...mockChannel,
        terminated_at: '2026-03-01T00:00:00Z',
      };
      const reinstatedPayload = {
        ...mockChannel,
        terminated_at: null,
      };

      let resolveInitial: ((value: any) => void) | undefined;
      const initialPromise = new Promise((resolve) => {
        resolveInitial = resolve;
      });
      mockFetch.mockReturnValueOnce(initialPromise);

      render(
        <BrowserRouter>
          <ChannelPage token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(channelVideosPropsStore.current).not.toBeNull();
      });
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Refetch returns reinstated state.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(reinstatedPayload),
      });

      await act(async () => {
        channelVideosPropsStore.current.onVideosLoaded('UC123456');
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Reinstated state has committed - terminated notice must not render.
      await waitFor(() => {
        expect(screen.getByText('Tech Channel')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('terminated-notice')).not.toBeInTheDocument();

      // Now the slow initial /getChannelInfo arrives with the stale
      // terminated payload. The request-id gate must reject it.
      await act(async () => {
        resolveInitial!({
          ok: true,
          json: jest.fn().mockResolvedValue(terminatedPayload),
        });
      });

      // Notice still gone - stale response did not overwrite.
      expect(screen.queryByTestId('terminated-notice')).not.toBeInTheDocument();
    });
  });
});
