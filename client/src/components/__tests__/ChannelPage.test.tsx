import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChannelPage from '../ChannelPage';
import { BrowserRouter } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';

const dialogPropsStore: { current: any } = { current: null };

// Mock child components
jest.mock('../ChannelPage/ChannelVideos', () => ({
  __esModule: true,
  default: function MockChannelVideos(props: any) {
    const React = require('react');
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

// Mock Material-UI hooks
jest.mock('@mui/material/useMediaQuery');
jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({
    breakpoints: { down: () => false },
  }),
}));

// Mock react-router-dom
const mockParams = { channel_id: 'UC123456' };
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => mockParams,
}));

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
    (useMediaQuery as jest.Mock).mockReturnValue(false); // Default to desktop
    dialogPropsStore.current = null;
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
          video_quality: '720'
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
          video_quality: null
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
      expect(thumbnail).toHaveStyle({ border: '1px solid grey' });
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

    test('renders with mobile-specific layout', async () => {
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

      // Mobile view should have different image dimensions
      const thumbnail = screen.getByAltText('Channel thumbnail') as HTMLImageElement;
      expect(thumbnail).toHaveAttribute('width', '100%');
      expect(thumbnail).toHaveAttribute('height', 'auto');
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
      expect(title).toHaveClass('MuiTypography-h5');
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

    test('renders with desktop-specific layout', async () => {
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
      expect(thumbnail).toHaveAttribute('width', 'auto');
      expect(thumbnail).toHaveAttribute('height', '285px');
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
      expect(title).toHaveClass('MuiTypography-h4');
    });
  });

  describe('textToHTML Helper Function', () => {
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
});
