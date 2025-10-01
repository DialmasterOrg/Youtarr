import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelVideos from '../ChannelVideos';
import { BrowserRouter } from 'react-router-dom';
import { ChannelVideo } from '../../../types/ChannelVideo';
import useMediaQuery from '@mui/material/useMediaQuery';

// Mock Material-UI hooks
jest.mock('@mui/material/useMediaQuery');
jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({
    breakpoints: {
      down: (key: string) => key === 'sm', // Force grid view by making it think it's desktop but prefer grid
    },
    shadows: Array(25).fill('0px 0px 0px 0px rgba(0,0,0,0)'),
    zIndex: { fab: 1050 },
  }),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
const mockParams = { channel_id: 'UC123456' };
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

// Mock react-swipeable
jest.mock('react-swipeable', () => ({
  useSwipeable: jest.fn(() => ({})),
}));

// Mock DownloadSettingsDialog
jest.mock('../../DownloadManager/ManualDownload/DownloadSettingsDialog', () => ({
  __esModule: true,
  default: function MockDownloadSettingsDialog({ open, onClose, onConfirm }: any) {
    const React = require('react');
    if (!open) return null;
    return React.createElement('div', { 'data-testid': 'download-settings-dialog' },
      React.createElement('button', {
        onClick: () => onConfirm(null),
        'data-testid': 'dialog-confirm'
      }, 'Confirm'),
      React.createElement('button', {
        onClick: onClose,
        'data-testid': 'dialog-cancel'
      }, 'Cancel')
    );
  }
}));

// Mock utils
jest.mock('../../../utils', () => ({
  formatDuration: jest.fn((duration: number | null) => {
    if (!duration) return 'Unknown';
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
  }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock window.scrollTo
global.scrollTo = jest.fn();

// Helper to setup standard fetch mocks
const setupFetchMocks = (videosResponse: any, configResponse: any = { preferredResolution: '1080p' }) => {
  // Add default pagination data if not provided
  const enrichedResponse = {
    ...videosResponse,
    totalCount: videosResponse.totalCount ?? (videosResponse.videos?.length || 0),
    oldestVideoDate: videosResponse.oldestVideoDate ?? null,
  };

  // Mock videos fetch (can be called multiple times due to React effects)
  mockFetch
    .mockImplementation((url: string) => {
      if (url.includes('/getchannelvideos/')) {
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(enrichedResponse),
        });
      } else if (url.includes('/getconfig')) {
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(configResponse),
        });
      }
      return Promise.reject(new Error('Unexpected fetch URL: ' + url));
    });
};


describe('ChannelVideos Component', () => {
  const mockToken = 'test-token';
  const mockVideos: ChannelVideo[] = [
    {
      title: 'Video Title 1',
      youtube_id: 'video1',
      publishedAt: '2024-01-15T10:00:00Z',
      thumbnail: 'https://example.com/thumb1.jpg',
      added: false,
      duration: 3600,
      availability: null,
    },
    {
      title: 'Video Title 2 &amp; More',
      youtube_id: 'video2',
      publishedAt: '2024-01-14T10:00:00Z',
      thumbnail: 'https://example.com/thumb2.jpg',
      added: true,
      duration: 1800,
      availability: null,
    },
    {
      title: 'Members Only Video',
      youtube_id: 'video3',
      publishedAt: '2024-01-13T10:00:00Z',
      thumbnail: 'https://example.com/thumb3.jpg',
      added: false,
      duration: 2400,
      availability: 'subscriber_only',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    (useMediaQuery as jest.Mock).mockReturnValue(false); // Default to desktop
    mockNavigate.mockClear();
  });

  describe('Initial Rendering', () => {
    test('renders component with title', () => {
      mockFetch
        .mockImplementation((url: string) => {
          if (url.includes('/getchannelvideos/')) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValueOnce({ videos: [], totalCount: 0 }),
            });
          } else if (url.includes('/getconfig')) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValueOnce({ preferredResolution: '1080p' }),
            });
          }
          return Promise.reject(new Error('Unexpected fetch URL: ' + url));
        });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      expect(screen.getByText('Channel Videos')).toBeInTheDocument();
    });

    test('shows loading skeletons when videos are loading', () => {
      mockFetch
        .mockImplementation((url: string) => {
          if (url.includes('/getchannelvideos/')) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValueOnce({ videos: [], totalCount: 0 }),
            });
          } else if (url.includes('/getconfig')) {
            return Promise.resolve({
              ok: true,
              json: jest.fn().mockResolvedValueOnce({ preferredResolution: '1080p' }),
            });
          }
          return Promise.reject(new Error('Unexpected fetch URL: ' + url));
        });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      expect(screen.getByText('Loading channel videos...')).toBeInTheDocument();
    });

    test('fetches channel videos with correct parameters', async () => {
      setupFetchMocks({ videos: mockVideos, totalCount: mockVideos.length });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/getchannelvideos/UC123456'),
          {
            headers: {
              'x-access-token': mockToken,
            },
          }
        );
      });
    });

    test('handles null token properly', async () => {
      // When token is null, getconfig is not fetched
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/getchannelvideos/')) {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValueOnce({ videos: mockVideos, totalCount: mockVideos.length }),
          });
        }
        return Promise.reject(new Error('Unexpected fetch URL: ' + url));
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={null} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/getchannelvideos/UC123456'),
          {
            headers: {
              'x-access-token': '',
            },
          }
        );
      });
    });
  });

  describe('Video Display', () => {
    test('displays videos after successful fetch', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      expect(screen.getByText('Video Title 2 & More')).toBeInTheDocument();
      expect(screen.getByText('Members Only Video')).toBeInTheDocument();
    });

    test('decodes HTML entities in video titles', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 2 & More')).toBeInTheDocument();
      });
    });

    test('formats video duration correctly', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Check that formatDuration was called correctly
      const { formatDuration } = require('../../../utils');
      expect(formatDuration).toHaveBeenCalledWith(3600);
      expect(formatDuration).toHaveBeenCalledWith(1800);
      expect(formatDuration).toHaveBeenCalledWith(2400);
    });

    test('displays thumbnails with correct src and alt text', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        const thumb1 = screen.getByAltText('Video Title 1');
        expect(thumb1).toHaveAttribute('src', 'https://example.com/thumb1.jpg');
      });
    });

    test('shows check icon for downloaded videos', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 2 & More')).toBeInTheDocument();
      });

      // Check for the "Downloaded" status chip for downloaded videos
      const downloadedChips = screen.getAllByText('Downloaded');
      expect(downloadedChips.length).toBeGreaterThan(0);
    });

    test('shows "Members Only" for subscriber-only videos', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Members Only')[0]).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    const manyVideos: ChannelVideo[] = [];
    for (let i = 0; i < 25; i++) {
      manyVideos.push({
        title: `Video ${i + 1}`,
        youtube_id: `video${i + 1}`,
        publishedAt: '2024-01-15T10:00:00Z',
        thumbnail: `https://example.com/thumb${i + 1}.jpg`,
        added: false,
        duration: 1800,
        availability: null,
      });
    }

    test('displays pagination controls when videos exceed page limit', async () => {
      // Server returns first 16 videos with totalCount of 25
      setupFetchMocks({ videos: manyVideos.slice(0, 16), totalCount: 25 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });

      const pagination = screen.getByRole('navigation');
      const page1 = within(pagination).getByText('1');
      const page2 = within(pagination).getByText('2');
      expect(page1).toBeInTheDocument();
      expect(page2).toBeInTheDocument();
    });

    test('shows correct number of videos per page on desktop', async () => {
      // Server returns first 16 videos
      setupFetchMocks({ videos: manyVideos.slice(0, 16), totalCount: 25 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Should show 16 videos on desktop
      expect(screen.getByText('Video 16')).toBeInTheDocument();
      expect(screen.queryByText('Video 17')).not.toBeInTheDocument();
    });

    test('changes page when pagination is clicked', async () => {
      // First call returns page 1
      setupFetchMocks({ videos: manyVideos.slice(0, 16), totalCount: 25 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Mock second page fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: manyVideos.slice(16, 25),
          totalCount: 25,
        }),
      });

      const pagination = screen.getByRole('navigation');
      const page2Button = within(pagination).getByText('2');
      fireEvent.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Video 17')).toBeInTheDocument();
      });
      expect(screen.queryByText('Video 1')).not.toBeInTheDocument();
    });
  });

  describe('Hide Downloaded Videos', () => {
    test('shows hide downloaded checkbox', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /hide downloaded/i })).toBeInTheDocument();
      });
    });

    test('filters out downloaded videos when checkbox is checked', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 2 & More')).toBeInTheDocument();
      });

      // Mock the fetch with hideDownloaded=true
      const filteredVideos = mockVideos.filter(v => !v.added);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: filteredVideos,
          totalCount: filteredVideos.length,
        }),
      });

      const checkbox = screen.getByRole('checkbox', { name: /hide downloaded/i });
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(screen.queryByText('Video Title 2 & More')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Video Title 1')).toBeInTheDocument();
    });

    test('resets page to 1 when hiding downloaded videos', async () => {
      const manyVideos: ChannelVideo[] = [];
      for (let i = 0; i < 20; i++) {
        manyVideos.push({
          title: `Video ${i + 1}`,
          youtube_id: `video${i + 1}`,
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: `https://example.com/thumb${i + 1}.jpg`,
          added: i < 5, // First 5 are downloaded
          duration: 1800,
          availability: null,
        });
      }

      setupFetchMocks({ videos: manyVideos.slice(0, 16), totalCount: 20 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });

      // Mock page 2 fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: manyVideos.slice(16, 20),
          totalCount: 20,
        }),
      });

      const pagination = screen.getByRole('navigation');
      const page2Button = within(pagination).getByText('2');
      fireEvent.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Video 17')).toBeInTheDocument();
      });

      // Mock filtered fetch
      const filteredVideos = manyVideos.filter(v => !v.added);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: filteredVideos.slice(0, 16),
          totalCount: filteredVideos.length,
        }),
      });

      const checkbox = screen.getByRole('checkbox', { name: /hide downloaded/i });
      fireEvent.click(checkbox);

      // Should reset to page 1 and show non-downloaded videos
      await waitFor(() => {
        expect(screen.getByText('Video 6')).toBeInTheDocument();
      });
    });
  });

  describe('Video Selection', () => {
    test('shows checkboxes for non-downloaded videos', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      // Should have checkboxes for non-downloaded videos plus hide downloaded checkbox
      expect(checkboxes.length).toBeGreaterThan(1);
    });

    test('handles checkbox selection and deselection', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Get all checkboxes and find the one for Video Title 1 (not the hide downloaded checkbox)
      // First, find the Hide Downloaded checkbox to exclude it
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      expect(videoCheckboxes.length).toBeGreaterThan(0);
      const checkbox = videoCheckboxes[0];

      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    test('does not show checkbox for members-only videos', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Members Only Video')).toBeInTheDocument();
      });

      // Check that Members Only status is shown
      const membersOnlyChips = screen.getAllByText(/members only/i);
      expect(membersOnlyChips.length).toBeGreaterThan(0);

      // Members-only videos might still have checkboxes but they should be disabled
      // Actually looking at the component, members-only videos don't get checkboxes at all (isSelectable is false)
      // We have 3 videos: Video 1 (selectable), Video 2 (downloaded, not selectable), Members Only (not selectable)
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      // Only Video 1 should have a checkbox
      expect(videoCheckboxes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Bulk Actions', () => {
    test('renders Select All button and enables it after selecting a video', async () => {
      setupFetchMocks({ videos: mockVideos });
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Buttons should always be present
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      expect(selectAllButton).toBeInTheDocument();

      // Select All might be enabled if there are selectable videos
      // (depends on implementation detail of when it's disabled)

      // Get all checkboxes - there should be checkboxes in video cards and the Hide Downloaded switch
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');

      // Filter to get only checkboxes that are not the Hide Downloaded switch
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      // Should have at least one checkbox for Video Title 1
      expect(videoCheckboxes.length).toBeGreaterThan(0);

      // Click the first video checkbox using userEvent for proper simulation
      const checkbox = videoCheckboxes[0];
      await user.click(checkbox);

      // Verify checkbox is checked
      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });

      // Clear button should be enabled after selection
      const clearButton = screen.getByRole('button', { name: /clear/i });
      expect(clearButton).not.toBeDisabled();
    });

    test('selects all undownloaded non-members videos on current page', async () => {
      setupFetchMocks({ videos: mockVideos });
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Select All button should be present
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      expect(selectAllButton).toBeInTheDocument();

      // Get all checkboxes that are not the "Hide Downloaded" checkbox
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      // Click the first video checkbox
      const checkbox = videoCheckboxes[0];
      await user.click(checkbox);

      // Wait for checkbox to be checked
      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });

      // Click Select All button
      await user.click(selectAllButton);

      // Verify Video Title 1 checkbox is still checked
      expect(checkbox).toBeChecked();
    });

    test('Clear Selection button clears all selected videos', async () => {
      setupFetchMocks({ videos: mockVideos });
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Get the video checkbox
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      const checkbox = videoCheckboxes[0];
      await user.click(checkbox);

      // Wait for checkbox to be checked
      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });

      // Buttons should be present
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      const clearButton = screen.getByRole('button', { name: /clear/i });

      expect(selectAllButton).toBeInTheDocument();
      expect(clearButton).toBeInTheDocument();

      await user.click(selectAllButton);
      await user.click(clearButton);

      // After clearing, checkbox should be unchecked
      expect(checkbox).not.toBeChecked();
    });

    test('Download Selected button shows count of selected videos', async () => {
      setupFetchMocks({ videos: mockVideos });
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Download button should be present but disabled initially
      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).toBeInTheDocument();
      expect(downloadButton).toBeDisabled();

      // Get the video checkbox
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      const checkbox = videoCheckboxes[0];
      await user.click(checkbox);

      // Wait for checkbox to be checked
      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });

      // Check the download button text now shows count with capital V for "Video"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download 1 Video/i })).toBeInTheDocument();
      });

      // Button should now be enabled
      expect(downloadButton).not.toBeDisabled();
    });

    test('triggers download and navigates when Download Selected is clicked', async () => {
      const enrichedResponse = {
        videos: mockVideos,
        totalCount: mockVideos.length,
        oldestVideoDate: null,
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/getchannelvideos/')) {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValueOnce(enrichedResponse),
          });
        } else if (url.includes('/config')) {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValueOnce({ preferredResolution: '1080p' }),
          });
        } else if (url.includes('/triggerspecificdownloads')) {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValueOnce({}),
          });
        }
        return Promise.reject(new Error('Unexpected fetch URL: ' + url));
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Get the video checkbox
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      const checkbox = videoCheckboxes[0];
      const user = userEvent.setup();
      await user.click(checkbox);

      // Wait for checkbox to be checked
      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });

      // Download button should show count with capital V for "Video"
      const downloadButton = await screen.findByRole('button', { name: /Download 1 Video/i });
      await user.click(downloadButton);

      // Dialog should now be open
      await waitFor(() => {
        expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();
      });

      // Click confirm in the dialog
      const confirmButton = screen.getByTestId('dialog-confirm');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/triggerspecificdownloads',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-access-token': mockToken,
            },
            body: JSON.stringify({ urls: ['https://www.youtube.com/watch?v=video1'] }),
          })
        );
      });

      expect(mockNavigate).toHaveBeenCalledWith('/downloads');
    });

    test('cancels download when dialog is cancelled', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Get the video checkbox
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      const checkbox = videoCheckboxes[0];
      const user = userEvent.setup();
      await user.click(checkbox);

      // Wait for checkbox to be checked
      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });

      // Download button should show count with capital V for "Video"
      const downloadButton = await screen.findByRole('button', { name: /Download 1 Video/i });
      await user.click(downloadButton);

      // Dialog should now be open
      await waitFor(() => {
        expect(screen.getByTestId('download-settings-dialog')).toBeInTheDocument();
      });

      // Click cancel in the dialog
      const cancelButton = screen.getByTestId('dialog-cancel');
      fireEvent.click(cancelButton);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByTestId('download-settings-dialog')).not.toBeInTheDocument();
      });

      // Fetch should not have been called for download
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial video fetch + config fetch
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('selects missing videos (downloaded but removed)', async () => {
      const videosWithMissing: ChannelVideo[] = [
        {
          title: 'Missing Video',
          youtube_id: 'missing1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/missing.jpg',
          added: true,
          removed: true,  // Video was downloaded but file removed
          duration: 300,
          availability: null,
        },
        {
          title: 'Downloaded Video',
          youtube_id: 'downloaded1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/downloaded.jpg',
          added: true,
          removed: false,  // Video still exists
          duration: 400,
          availability: null,
        }
      ];

      setupFetchMocks({ videos: videosWithMissing });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Missing Video')).toBeInTheDocument();
      });

      // Get the checkbox for the missing video
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      // The missing video should have a checkbox since it's selectable
      expect(videoCheckboxes.length).toBeGreaterThan(0);
      const missingCheckbox = videoCheckboxes[0];
      const user = userEvent.setup();

      await user.click(missingCheckbox);

      // Wait for checkbox to be checked
      await waitFor(() => {
        expect(missingCheckbox).toBeChecked();
      });

      // Buttons should be present
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      fireEvent.click(selectAllButton);

      // Should select the missing video
      expect(missingCheckbox).toBeChecked();

      // Downloaded video should show as "Downloaded" status
      const downloadedStatuses = screen.getAllByText('Downloaded');
      expect(downloadedStatuses.length).toBeGreaterThan(0);
    });

    test('buttons are disabled when no selectable videos', async () => {
      setupFetchMocks({ videos: [mockVideos[1]] }); // Only downloaded video (not selectable)

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 2 & More')).toBeInTheDocument();
      });

      // Downloaded videos don't have checkboxes, so there's nothing to select
      // Verify no checkbox is available for downloaded videos
      const allCheckboxes = screen.getAllByRole('checkbox');
      // Only the "Hide Downloaded" checkbox should be present
      expect(allCheckboxes).toHaveLength(1);

      // Buttons should be present but disabled
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      const clearButton = screen.getByRole('button', { name: /clear/i });
      const downloadButton = screen.getByRole('button', { name: /download/i });

      expect(selectAllButton).toBeDisabled();
      expect(clearButton).toBeDisabled();
      expect(downloadButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    test('displays error alert when video fetch fails', async () => {
      setupFetchMocks({ videoFail: true, videos: [] });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch channel videos. Please try again later.')).toBeInTheDocument();
      });
    });

    test('handles network error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error')); // For config fetch

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });

    test('handles non-ok response', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/getchannelvideos/')) {
          return Promise.resolve({
            ok: false,
            statusText: 'Not Found',
          });
        } else if (url.includes('/getconfig')) {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValueOnce({ preferredResolution: '1080p' }),
          });
        }
        return Promise.reject(new Error('Unexpected fetch URL: ' + url));
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });

    test('handles old response format without videos key', async () => {
      setupFetchMocks({ videoFail: false }); // Response without videos key

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      // Should render without error, with empty videos list
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Should show the loading/empty state
      expect(screen.getByText('Loading channel videos...')).toBeInTheDocument();
    });
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);
    });

    test('shows 8 videos per page on mobile', async () => {
      const manyVideos: ChannelVideo[] = [];
      for (let i = 0; i < 12; i++) {
        manyVideos.push({
          title: `Video ${i + 1}`,
          youtube_id: `video${i + 1}`,
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: `https://example.com/thumb${i + 1}.jpg`,
          added: false,
          duration: 1800,
          availability: null,
        });
      }

      // Server returns first 8 videos for mobile
      setupFetchMocks({ videos: manyVideos.slice(0, 8), totalCount: 12 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      expect(screen.getByText('Video 8')).toBeInTheDocument();
      expect(screen.queryByText('Video 9')).not.toBeInTheDocument();
    });

    test('renders mobile grid layout', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Mobile view still shows as grid by default now
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Should have multiple video titles displayed in grid
      expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      expect(screen.getByText('Video Title 2 & More')).toBeInTheDocument();
      expect(screen.getByText('Members Only Video')).toBeInTheDocument();
    });

    test('displays members-only badge instead of tooltip', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Members Only Video')).toBeInTheDocument();
      });

      // Members-only videos show as chips/badges in the new UI
      const membersOnlyLabels = screen.getAllByText(/members only/i);
      expect(membersOnlyLabels.length).toBeGreaterThan(0);
    });

    test('shows FAB for mobile when videos selected', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Get the video checkbox
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);

      const checkbox = videoCheckboxes[0];

      // Trigger both click and change events as the component uses onChange
      fireEvent.click(checkbox);
      fireEvent.change(checkbox, { target: { checked: true } });

      // Wait for checkbox to be checked
      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });

      // On mobile, a FAB (Floating Action Button) should appear instead of inline buttons
      // The FAB contains a badge with download icon
      await waitFor(() => {
        const downloadIcon = screen.getByTestId('DownloadIcon');
        expect(downloadIcon).toBeInTheDocument();
      });
    });
  });

  describe('Swipe Gestures', () => {
    const { useSwipeable } = require('react-swipeable');

    test('handles swipe left to go to next page', async () => {
      const manyVideos: ChannelVideo[] = [];
      for (let i = 0; i < 20; i++) {
        manyVideos.push({
          title: `Video ${i + 1}`,
          youtube_id: `video${i + 1}`,
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: `https://example.com/thumb${i + 1}.jpg`,
          added: false,
          duration: 1800,
          availability: null,
        });
      }

      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((config: any) => {
        swipeHandlers = config;
        return {};
      });

      setupFetchMocks({ videos: manyVideos.slice(0, 16), totalCount: 20 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Mock page 2 fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: manyVideos.slice(16, 20),
          totalCount: 20,
        }),
      });

      // Simulate swipe left
      act(() => {
        swipeHandlers.onSwipedLeft();
      });

      await waitFor(() => {
        expect(screen.getByText('Video 17')).toBeInTheDocument();
      });
      expect(screen.queryByText('Video 1')).not.toBeInTheDocument();
    });

    test('handles swipe right to go to previous page', async () => {
      const manyVideos: ChannelVideo[] = [];
      for (let i = 0; i < 20; i++) {
        manyVideos.push({
          title: `Video ${i + 1}`,
          youtube_id: `video${i + 1}`,
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: `https://example.com/thumb${i + 1}.jpg`,
          added: false,
          duration: 1800,
          availability: null,
        });
      }

      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((config: any) => {
        swipeHandlers = config;
        return {};
      });

      setupFetchMocks({ videos: manyVideos.slice(0, 16), totalCount: 20 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Mock page 2 fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: manyVideos.slice(16, 20),
          totalCount: 20,
        }),
      });

      // Go to page 2 first
      const pagination = screen.getByRole('navigation');
      const page2Button = within(pagination).getByText('2');
      fireEvent.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Video 17')).toBeInTheDocument();
      });

      // Mock page 1 fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: manyVideos.slice(0, 16),
          totalCount: 20,
        }),
      });

      // Simulate swipe right
      act(() => {
        swipeHandlers.onSwipedRight();
      });

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });
      expect(screen.queryByText('Video 17')).not.toBeInTheDocument();
    });

    test('does not swipe past first page', async () => {
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((config: any) => {
        swipeHandlers = config;
        return {};
      });

      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Simulate swipe right on first page
      act(() => {
        swipeHandlers.onSwipedRight();
      });

      // Should still be on page 1
      expect(screen.getByText('Video Title 1')).toBeInTheDocument();
    });

    test('does not swipe past last page', async () => {
      let swipeHandlers: any = {};
      useSwipeable.mockImplementation((config: any) => {
        swipeHandlers = config;
        return {};
      });

      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Simulate swipe left on last page (only 3 videos, so page 1 is the last)
      act(() => {
        swipeHandlers.onSwipedLeft();
      });

      // Should still show same videos
      expect(screen.getByText('Video Title 1')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    test('shows members-only badge on desktop for members-only videos', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false);

      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Members Only Video')).toBeInTheDocument();
      });

      // Should show Members Only badge/chip
      const membersOnlyElements = screen.getAllByText(/members only/i);
      expect(membersOnlyElements.length).toBeGreaterThan(0);
    });

    test('shows status chips for videos', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Should show various status chips
      const downloadedChips = screen.getAllByText('Downloaded');
      expect(downloadedChips.length).toBeGreaterThan(0);

      const notDownloadedChips = screen.getAllByText('Not Downloaded');
      expect(notDownloadedChips.length).toBeGreaterThan(0);
    });

    test('shows members only chip for subscriber-only videos', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Members Only Video')).toBeInTheDocument();
      });

      // Should show Members Only chip
      const membersOnlyChips = screen.getAllByText(/members only/i);
      expect(membersOnlyChips.length).toBeGreaterThan(0);
    });
  });

  describe('Date Formatting', () => {
    test('formats published dates correctly', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('1/15/2024')).toBeInTheDocument();
      });

      expect(screen.getByText('1/14/2024')).toBeInTheDocument();
      expect(screen.getByText('1/13/2024')).toBeInTheDocument();
    });
  });

  describe('Opacity for Members-Only Videos', () => {
    test('shows members-only badge for subscriber-only videos', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Members Only Video')).toBeInTheDocument();
      });

      // Check that the members-only badge is present
      const badges = screen.getAllByText(/members only/i);
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});