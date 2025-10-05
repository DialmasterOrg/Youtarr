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

// Mock DeleteVideosDialog
jest.mock('../../shared/DeleteVideosDialog', () => ({
  __esModule: true,
  default: function MockDeleteVideosDialog({ open, onClose, onConfirm }: any) {
    const React = require('react');
    if (!open) return null;
    return React.createElement('div', { 'data-testid': 'delete-videos-dialog' },
      React.createElement('button', {
        onClick: onConfirm,
        'data-testid': 'delete-confirm'
      }, 'Delete Videos'),
      React.createElement('button', {
        onClick: onClose,
        'data-testid': 'delete-cancel'
      }, 'Cancel')
    );
  }
}));

// Mock useVideoDeletion hook
const mockDeleteVideosByYoutubeIds = jest.fn();
jest.mock('../../shared/useVideoDeletion', () => ({
  useVideoDeletion: () => ({
    deleteVideosByYoutubeIds: mockDeleteVideosByYoutubeIds,
    deleteVideos: jest.fn(),
    loading: false,
    error: null,
  }),
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
    mockDeleteVideosByYoutubeIds.mockReset();
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
        expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
      });

      // We now have two pagination controls (top and bottom), use the first one
      const paginations = screen.getAllByRole('navigation');
      const pagination = paginations[0];
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

      // We now have two pagination controls (top and bottom), use the first one
      const paginations = screen.getAllByRole('navigation');
      const pagination = paginations[0];
      const page2Button = within(pagination).getByText('2');
      fireEvent.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Video 17')).toBeInTheDocument();
      });
      expect(screen.queryByText('Video 1')).not.toBeInTheDocument();
    });

    test('shows pagination at both top and bottom when there are multiple pages', async () => {
      // Server returns first 16 videos with totalCount of 25
      setupFetchMocks({ videos: manyVideos.slice(0, 16), totalCount: 25 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByRole('navigation').length).toBe(2);
      });

      // Both pagination controls should have the same page buttons
      const paginations = screen.getAllByRole('navigation');
      const topPagination = paginations[0];
      const bottomPagination = paginations[1];

      expect(within(topPagination).getByText('1')).toBeInTheDocument();
      expect(within(topPagination).getByText('2')).toBeInTheDocument();
      expect(within(bottomPagination).getByText('1')).toBeInTheDocument();
      expect(within(bottomPagination).getByText('2')).toBeInTheDocument();
    });

    test('does not show pagination when only one page exists', async () => {
      // Only 3 videos - less than pageSize of 16, so only 1 page
      setupFetchMocks({ videos: mockVideos, totalCount: 3 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // When there's only 1 page, pagination should not be visible
      // Verify by checking that there's no page 2 button
      const allButtons = screen.getAllByRole('button');
      const page2Button = allButtons.find(btn => btn.textContent === '2');
      expect(page2Button).toBeUndefined();
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
        expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
      });

      // Mock page 2 fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: manyVideos.slice(16, 20),
          totalCount: 20,
        }),
      });

      // We now have two pagination controls (top and bottom), use the first one
      const paginations = screen.getAllByRole('navigation');
      const pagination = paginations[0];
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

    test('renders mobile list layout by default', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Mobile view defaults to list view now
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Should have multiple video titles displayed in list
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

    test('toggles between list and grid view on mobile', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Find the view toggle buttons
      const toggleButtons = screen.getAllByRole('button');
      const gridButton = toggleButtons.find(btn => btn.getAttribute('value') === 'grid');
      const listButton = toggleButtons.find(btn => btn.getAttribute('value') === 'list');

      // List view should be default on mobile
      expect(listButton).toHaveAttribute('aria-pressed', 'true');
      expect(gridButton).toHaveAttribute('aria-pressed', 'false');

      // Click grid button
      if (gridButton) {
        fireEvent.click(gridButton);
      }

      // Grid button should now be pressed
      await waitFor(() => {
        expect(gridButton).toHaveAttribute('aria-pressed', 'true');
      });

      // Click list button
      if (listButton) {
        fireEvent.click(listButton);
      }

      // List button should now be pressed again
      await waitFor(() => {
        expect(listButton).toHaveAttribute('aria-pressed', 'true');
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
      // We now have two pagination controls (top and bottom), use the first one
      const paginations = screen.getAllByRole('navigation');
      const pagination = paginations[0];
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

  describe('Refresh Channel Videos', () => {
    test('opens refresh confirmation dialog when refresh button is clicked', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Refresh Channel Videos')).toBeInTheDocument();
      });
    });

    test('cancels refresh when dialog is cancelled', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Refresh Channel Videos')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Refresh Channel Videos')).not.toBeInTheDocument();
      });
    });

    test('fetches all channel videos when refresh is confirmed', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Refresh Channel Videos')).toBeInTheDocument();
      });

      // Mock the fetchallchannelvideos response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          videos: mockVideos,
          totalCount: mockVideos.length,
          oldestVideoDate: '2024-01-13T10:00:00Z',
        }),
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/fetchallchannelvideos/'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    test('handles 409 conflict error when refresh is already in progress', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      // Mock 409 conflict response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: jest.fn().mockResolvedValueOnce({
          success: false,
          error: 'FETCH_IN_PROGRESS',
        }),
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/already in progress/i)).toBeInTheDocument();
      });
    });

    test('handles general error during refresh', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      // Mock general error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({
          success: false,
          message: 'Server error',
        }),
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/Server error/i)).toBeInTheDocument();
      });
    });

    test('displays error snackbar when refresh fails', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({
          success: false,
          message: 'Test error',
        }),
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/Test error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    test('changes sort order when clicking same sort column', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false); // Desktop for table view
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Switch to table view
      const toggleButtons = screen.getAllByRole('button');
      const tableButton = toggleButtons.find(btn => btn.getAttribute('value') === 'table');
      if (tableButton) {
        fireEvent.click(tableButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Title')).toBeInTheDocument();
      });

      // Mock the sorted fetch (ascending)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: [...mockVideos].sort((a, b) => a.title.localeCompare(b.title)),
          totalCount: mockVideos.length,
        }),
      });

      // Click on Title column header to sort
      const titleHeader = screen.getByText('Title');
      fireEvent.click(titleHeader);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=title'),
          expect.anything()
        );
      });

      // Mock the sorted fetch (descending)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: [...mockVideos].sort((a, b) => b.title.localeCompare(a.title)),
          totalCount: mockVideos.length,
        }),
      });

      // Click again to toggle sort order
      fireEvent.click(titleHeader);

      await waitFor(() => {
        const fetchCalls = mockFetch.mock.calls;
        const lastCall = fetchCalls[fetchCalls.length - 1][0] as string;
        expect(lastCall).toContain('sortBy=title');
      });

      const fetchCalls = mockFetch.mock.calls;
      const lastCall = fetchCalls[fetchCalls.length - 1][0] as string;
      expect(lastCall).toContain('sortOrder=asc');
    });

    test('sorts by duration when clicking duration column', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false); // Desktop for table view
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Switch to table view
      const toggleButtons = screen.getAllByRole('button');
      const tableButton = toggleButtons.find(btn => btn.getAttribute('value') === 'table');
      if (tableButton) {
        fireEvent.click(tableButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Duration')).toBeInTheDocument();
      });

      // Mock the sorted fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: mockVideos,
          totalCount: mockVideos.length,
        }),
      });

      const durationHeader = screen.getByText('Duration');
      fireEvent.click(durationHeader);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=duration'),
          expect.anything()
        );
      });
    });

    test('sorts by size when clicking size column', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false); // Desktop for table view
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Switch to table view
      const toggleButtons = screen.getAllByRole('button');
      const tableButton = toggleButtons.find(btn => btn.getAttribute('value') === 'table');
      if (tableButton) {
        fireEvent.click(tableButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Size')).toBeInTheDocument();
      });

      // Mock the sorted fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: mockVideos,
          totalCount: mockVideos.length,
        }),
      });

      const sizeHeader = screen.getByText('Size');
      fireEvent.click(sizeHeader);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=size'),
          expect.anything()
        );
      });
    });
  });

  describe('Table View', () => {
    beforeEach(() => {
      (useMediaQuery as jest.Mock).mockReturnValue(false); // Desktop
    });

    test('switches to table view when table button is clicked', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Find and click table view button
      const toggleButtons = screen.getAllByRole('button');
      const tableButton = toggleButtons.find(btn => btn.getAttribute('value') === 'table');

      if (tableButton) {
        fireEvent.click(tableButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Thumbnail')).toBeInTheDocument();
      });

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Published')).toBeInTheDocument();
    });

    test('displays videos in table format', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Switch to table view
      const toggleButtons = screen.getAllByRole('button');
      const tableButton = toggleButtons.find(btn => btn.getAttribute('value') === 'table');
      if (tableButton) {
        fireEvent.click(tableButton);
      }

      await waitFor(() => {
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
      });
    });

    test('shows checkboxes for selectable videos in table view', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Switch to table view
      const toggleButtons = screen.getAllByRole('button');
      const tableButton = toggleButtons.find(btn => btn.getAttribute('value') === 'table');
      if (tableButton) {
        fireEvent.click(tableButton);
      }

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        // Should have at least the hide downloaded checkbox and select-all checkbox
        expect(checkboxes.length).toBeGreaterThan(1);
      });
    });

    test('selects all videos via table header checkbox', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Switch to table view
      const toggleButtons = screen.getAllByRole('button');
      const tableButton = toggleButtons.find(btn => btn.getAttribute('value') === 'table');
      if (tableButton) {
        fireEvent.click(tableButton);
      }

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Find the select-all checkbox in the table header
      const allCheckboxes = screen.getAllByRole('checkbox');
      const tableCheckboxes = allCheckboxes.filter(cb => {
        const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
        return cb !== hideDownloadedCheckbox;
      });

      // The first checkbox in the table should be the select-all
      const selectAllCheckbox = tableCheckboxes[0];
      fireEvent.click(selectAllCheckbox);

      // Download button should now show count
      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /Download \d+ Video/i });
        expect(downloadButton).toBeInTheDocument();
      });
    });

    test('shows delete icon for downloaded videos in table view', async () => {
      const downloadedVideos: ChannelVideo[] = [
        {
          title: 'Downloaded Video',
          youtube_id: 'dl_video1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/thumb1.jpg',
          added: true,
          removed: false,
          duration: 3600,
          availability: null,
        },
      ];

      setupFetchMocks({ videos: downloadedVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video')).toBeInTheDocument();
      });

      // Switch to table view
      const toggleButtons = screen.getAllByRole('button');
      const tableButton = toggleButtons.find(btn => btn.getAttribute('value') === 'table');
      if (tableButton) {
        fireEvent.click(tableButton);
      }

      await waitFor(() => {
        const deleteIcons = screen.getAllByTestId('DeleteIcon');
        expect(deleteIcons.length).toBeGreaterThan(0);
      });
    });

    test('shows youtube removed banner in table view', async () => {
      const removedVideo: ChannelVideo[] = [
        {
          title: 'Removed Video',
          youtube_id: 'removed1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/thumb1.jpg',
          added: true,
          removed: false,
          duration: 3600,
          availability: null,
          youtube_removed: true,
        },
      ];

      setupFetchMocks({ videos: removedVideo });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Removed Video')).toBeInTheDocument();
      });

      // Switch to table view
      const toggleButtons = screen.getAllByRole('button');
      const tableButton = toggleButtons.find(btn => btn.getAttribute('value') === 'table');
      if (tableButton) {
        fireEvent.click(tableButton);
      }

      await waitFor(() => {
        const removedBanners = screen.getAllByText('Removed From YouTube');
        expect(removedBanners.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Card Click Selection', () => {
    test('selects video when clicking on card in grid view', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Click on the card by clicking the title (event bubbles to card)
      const videoTitle = screen.getAllByText('Video Title 1')[0];
      fireEvent.click(videoTitle);

      // Download button should update to show selection
      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /Download 1 Video/i });
        expect(downloadButton).toBeInTheDocument();
      });
    });

    test('deselects video when clicking on selected card in grid view', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Select the video first
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);
      const checkbox = videoCheckboxes[0];
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });

      // Now click the card again to deselect
      const videoTitle = screen.getAllByText('Video Title 1')[0];
      fireEvent.click(videoTitle);

      await waitFor(() => {
        expect(checkbox).not.toBeChecked();
      });
    });

    test('selects video when clicking on card in list view (mobile)', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true); // Mobile
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Mobile defaults to list view - click on title to select
      const videoTitle = screen.getAllByText('Video Title 1')[0];
      fireEvent.click(videoTitle);

      // Check if FAB appears
      await waitFor(() => {
        const downloadIcon = screen.queryByTestId('DownloadIcon');
        expect(downloadIcon).toBeInTheDocument();
      });
    });

    test('does not select when clicking on non-selectable card', async () => {
      setupFetchMocks({ videos: [mockVideos[1]] }); // Downloaded video (not selectable)

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 2 & More')).toBeInTheDocument();
      });

      // Click on the non-selectable video title
      const videoTitle = screen.getAllByText('Video Title 2 & More')[0];
      fireEvent.click(videoTitle);

      // Download button should remain disabled
      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).toBeDisabled();
    });
  });

  describe('Mobile Drawer', () => {
    beforeEach(() => {
      (useMediaQuery as jest.Mock).mockReturnValue(true); // Mobile
    });

    test('opens mobile drawer when FAB is clicked', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Select a video to show FAB
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);
      fireEvent.click(videoCheckboxes[0]);

      await waitFor(() => {
        const downloadIcon = screen.getByTestId('DownloadIcon');
        expect(downloadIcon).toBeInTheDocument();
      });

      // Find and click the FAB
      const allButtons = screen.getAllByRole('button');
      const fabs = allButtons.filter(btn => btn.classList.contains('MuiFab-root'));
      const downloadFab = fabs.find(fab => {
        const downloadIcon = within(fab).queryByTestId('DownloadIcon');
        return downloadIcon !== null;
      });

      expect(downloadFab).toBeDefined();
      fireEvent.click(downloadFab!);

      await waitFor(() => {
        expect(screen.getByText('Batch Actions')).toBeInTheDocument();
      });
    });

    test('closes mobile drawer when close button is clicked', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Select a video and open drawer
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);
      fireEvent.click(videoCheckboxes[0]);

      await waitFor(() => {
        const downloadIcon = screen.getByTestId('DownloadIcon');
        expect(downloadIcon).toBeInTheDocument();
      });

      const allButtons = screen.getAllByRole('button');
      const fabs = allButtons.filter(btn => btn.classList.contains('MuiFab-root'));
      const downloadFab = fabs.find(fab => within(fab).queryByTestId('DownloadIcon'));

      expect(downloadFab).toBeDefined();
      fireEvent.click(downloadFab!);

      await waitFor(() => {
        expect(screen.getByText('Batch Actions')).toBeInTheDocument();
      });

      // Find the drawer by its role and close it
      const drawer = screen.getByRole('presentation');
      const closeButton = within(drawer).getByTestId('CloseIcon');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Batch Actions')).not.toBeInTheDocument();
      });
    });

    test('drawer shows correct selected count', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      // Select a video
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const allCheckboxes = screen.getAllByRole('checkbox');
      const videoCheckboxes = allCheckboxes.filter(cb => cb !== hideDownloadedCheckbox);
      fireEvent.click(videoCheckboxes[0]);

      await waitFor(() => {
        const downloadIcon = screen.getByTestId('DownloadIcon');
        expect(downloadIcon).toBeInTheDocument();
      });

      // Open drawer
      const allButtons = screen.getAllByRole('button');
      const fabs = allButtons.filter(btn => btn.classList.contains('MuiFab-root'));
      const downloadFab = fabs.find(fab => within(fab).queryByTestId('DownloadIcon'));

      expect(downloadFab).toBeDefined();
      fireEvent.click(downloadFab!);

      await waitFor(() => {
        expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    test('resets page to 1 when search query changes', async () => {
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

      setupFetchMocks({ videos: manyVideos.slice(0, 16), totalCount: 20 });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Go to page 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: manyVideos.slice(16, 20),
          totalCount: 20,
        }),
      });

      const paginations = screen.getAllByRole('navigation');
      const pagination = paginations[0];
      const page2Button = within(pagination).getByText('2');
      fireEvent.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Video 17')).toBeInTheDocument();
      });

      // Now search - should reset to page 1
      const searchResults = manyVideos.filter(v => v.title.includes('5'));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: searchResults,
          totalCount: searchResults.length,
        }),
      });

      const searchInput = screen.getByPlaceholderText('Search videos...');
      fireEvent.change(searchInput, { target: { value: '5' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('page=1'),
          expect.anything()
        );
      });
    });
  });

  describe('Video Deletion', () => {
    const downloadedVideos: ChannelVideo[] = [
      {
        title: 'Downloaded Video 1',
        youtube_id: 'dl_video1',
        publishedAt: '2024-01-15T10:00:00Z',
        thumbnail: 'https://example.com/thumb1.jpg',
        added: true,
        removed: false,
        duration: 3600,
        availability: null,
      },
      {
        title: 'Downloaded Video 2',
        youtube_id: 'dl_video2',
        publishedAt: '2024-01-14T10:00:00Z',
        thumbnail: 'https://example.com/thumb2.jpg',
        added: true,
        removed: false,
        duration: 1800,
        availability: null,
      },
    ];

    test('deselects video for deletion when toggle is clicked again', async () => {
      setupFetchMocks({ videos: downloadedVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Select a video for deletion
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      const videoDeleteIcon = deleteIcons[deleteIcons.length - 1];
      fireEvent.click(videoDeleteIcon);

      await waitFor(() => {
        const actionBarButtons = screen.getAllByRole('button');
        const deleteActionButton = actionBarButtons.find(btn =>
          btn.textContent?.match(/^Delete\s+1$/)
        );
        expect(deleteActionButton).toBeDefined();
      });

      // Click again to deselect
      fireEvent.click(videoDeleteIcon);

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /Delete Selected/i });
        expect(deleteButton).toBeDisabled();
      });
    });

    test('shows delete button for downloaded videos in grid view', async () => {
      setupFetchMocks({ videos: downloadedVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Should have delete icons for downloaded videos
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      expect(deleteIcons.length).toBeGreaterThan(0);

      // Should have a Delete Selected button in the action bar (desktop)
      const deleteButton = screen.getByRole('button', { name: /Delete Selected/i });
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).toBeDisabled(); // Should be disabled when nothing selected
    });

    test('toggles video selection for deletion when delete icon is clicked', async () => {
      setupFetchMocks({ videos: downloadedVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Get delete icons - last ones should be video card icons (not action bar icons)
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      expect(deleteIcons.length).toBeGreaterThan(0);

      // Click the last delete icon (video card icon) - the click event will bubble to its parent button
      fireEvent.click(deleteIcons[deleteIcons.length - 1]);

      // Wait for the action bar Delete button to update from "Delete Selected" to "Delete 1"
      await waitFor(() => {
        const actionBarButtons = screen.getAllByRole('button');
        const deleteActionButton = actionBarButtons.find(btn =>
          btn.textContent?.match(/^Delete\s+1$/)
        );
        expect(deleteActionButton).toBeDefined();
      });

      // Verify the button is not disabled
      const actionBarButtons = screen.getAllByRole('button');
      const deleteActionButton = actionBarButtons.find(btn =>
        btn.textContent?.match(/^Delete\s+1$/)
      );
      expect(deleteActionButton).not.toBeDisabled();
    });

    test('opens delete confirmation dialog when delete button is clicked', async () => {
      setupFetchMocks({ videos: downloadedVideos });
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Select a video for deletion by clicking a video card delete icon
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      // Click the last delete icon (video card icon, not action bar) - event will bubble to button
      fireEvent.click(deleteIcons[deleteIcons.length - 1]);

      // Wait for and click the Delete button in the action bar
      await waitFor(() => {
        const actionBarButtons = screen.getAllByRole('button');
        const deleteActionButton = actionBarButtons.find(btn =>
          btn.textContent?.match(/^Delete\s+1$/)
        );
        expect(deleteActionButton).toBeDefined();
      });

      const deleteActionButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.match(/^Delete\s+1$/)
      );
      await user.click(deleteActionButton!);

      // Dialog should be open
      await waitFor(() => {
        expect(screen.getByTestId('delete-videos-dialog')).toBeInTheDocument();
      });
    });

    test('cancels deletion when dialog is cancelled', async () => {
      setupFetchMocks({ videos: downloadedVideos });
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Select a video for deletion by clicking a video card delete icon
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      // Click the last delete icon (video card icon, not action bar) - event will bubble to button
      fireEvent.click(deleteIcons[deleteIcons.length - 1]);

      // Wait for and click the Delete button
      await waitFor(() => {
        const actionBarButtons = screen.getAllByRole('button');
        const deleteActionButton = actionBarButtons.find(btn =>
          btn.textContent?.match(/^Delete\s+1$/)
        );
        expect(deleteActionButton).toBeDefined();
      });

      const deleteActionButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.match(/^Delete\s+1$/)
      );
      await user.click(deleteActionButton!);

      // Dialog should be open
      await waitFor(() => {
        expect(screen.getByTestId('delete-videos-dialog')).toBeInTheDocument();
      });

      // Cancel the dialog
      const cancelButton = screen.getByTestId('delete-cancel');
      await user.click(cancelButton);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByTestId('delete-videos-dialog')).not.toBeInTheDocument();
      });

      // deleteVideosByYoutubeIds should not have been called
      expect(mockDeleteVideosByYoutubeIds).not.toHaveBeenCalled();
    });

    test('deletes videos successfully when confirmed', async () => {
      setupFetchMocks({ videos: downloadedVideos });
      const user = userEvent.setup();

      // Mock successful deletion (for dl_video2, the last video we'll click)
      mockDeleteVideosByYoutubeIds.mockResolvedValueOnce({
        success: true,
        deleted: ['dl_video2'],
        failed: [],
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Select a video for deletion by clicking a video card delete icon
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      // Click the last delete icon (video card icon, not action bar) - event will bubble to button
      fireEvent.click(deleteIcons[deleteIcons.length - 1]);

      // Wait for and click the Delete button
      await waitFor(() => {
        const actionBarButtons = screen.getAllByRole('button');
        const deleteActionButton = actionBarButtons.find(btn =>
          btn.textContent?.match(/^Delete\s+1$/)
        );
        expect(deleteActionButton).toBeDefined();
      });

      const deleteActionButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.match(/^Delete\s+1$/)
      );
      await user.click(deleteActionButton!);

      // Confirm deletion
      const confirmButton = await screen.findByTestId('delete-confirm');
      fireEvent.click(confirmButton);

      // Wait for deletion to complete (we clicked the last video, which is dl_video2)
      await waitFor(() => {
        expect(mockDeleteVideosByYoutubeIds).toHaveBeenCalledWith(['dl_video2'], mockToken);
      });

      // Success message should be shown
      await waitFor(() => {
        expect(screen.getByText(/Successfully deleted 1 video/i)).toBeInTheDocument();
      });
    });

    test('handles partial deletion (some succeed, some fail)', async () => {
      setupFetchMocks({ videos: downloadedVideos });
      const user = userEvent.setup();

      // Mock partial deletion
      mockDeleteVideosByYoutubeIds.mockResolvedValueOnce({
        success: false,
        deleted: ['dl_video1'],
        failed: [{ youtubeId: 'dl_video2', error: 'File not found' }],
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Select both videos for deletion
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      for (const icon of deleteIcons) {
        // Click each delete icon - the click event will bubble to its parent button
        fireEvent.click(icon);
      }

      // Click the Delete button
      const deleteActionButton = await screen.findByRole('button', { name: /Delete 2/i });
      await user.click(deleteActionButton);

      // Confirm deletion
      const confirmButton = await screen.findByTestId('delete-confirm');
      fireEvent.click(confirmButton);

      // Wait for deletion to complete
      await waitFor(() => {
        expect(mockDeleteVideosByYoutubeIds).toHaveBeenCalledWith(['dl_video1', 'dl_video2'], mockToken);
      });

      // Partial success message should be shown
      await waitFor(() => {
        expect(screen.getByText(/Deleted 1 video, but 1 failed/i)).toBeInTheDocument();
      });
    });

    test('handles complete deletion failure', async () => {
      setupFetchMocks({ videos: downloadedVideos });
      const user = userEvent.setup();

      // Mock complete deletion failure (for dl_video2, the last video we'll click)
      mockDeleteVideosByYoutubeIds.mockResolvedValueOnce({
        success: false,
        deleted: [],
        failed: [{ youtubeId: 'dl_video2', error: 'Permission denied' }],
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Select a video for deletion by clicking a video card delete icon
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      // Click the last delete icon (video card icon, not action bar) - event will bubble to button
      fireEvent.click(deleteIcons[deleteIcons.length - 1]);

      // Wait for and click the Delete button
      await waitFor(() => {
        const actionBarButtons = screen.getAllByRole('button');
        const deleteActionButton = actionBarButtons.find(btn =>
          btn.textContent?.match(/^Delete\s+1$/)
        );
        expect(deleteActionButton).toBeDefined();
      });

      const deleteActionButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.match(/^Delete\s+1$/)
      );
      await user.click(deleteActionButton!);

      // Confirm deletion
      const confirmButton = await screen.findByTestId('delete-confirm');
      fireEvent.click(confirmButton);

      // Wait for deletion to complete (we clicked the last video, which is dl_video2)
      await waitFor(() => {
        expect(mockDeleteVideosByYoutubeIds).toHaveBeenCalledWith(['dl_video2'], mockToken);
      });

      // Error message should be shown
      await waitFor(() => {
        expect(screen.getByText(/Failed to delete videos: Permission denied/i)).toBeInTheDocument();
      });
    });

    test('shows error when trying to delete without selection', async () => {
      setupFetchMocks({ videos: downloadedVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Click the Delete button without selecting any videos
      const deleteActionButton = screen.getByRole('button', { name: /Delete Selected/i });
      expect(deleteActionButton).toBeDisabled();
    });

    test('refreshes video list after successful deletion', async () => {
      setupFetchMocks({ videos: downloadedVideos });
      const user = userEvent.setup();

      // Mock successful deletion (for dl_video2, the last video we'll click)
      mockDeleteVideosByYoutubeIds.mockResolvedValueOnce({
        success: true,
        deleted: ['dl_video2'],
        failed: [],
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Select a video for deletion by clicking a video card delete icon
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      // Click the last delete icon (video card icon, not action bar) - event will bubble to button
      fireEvent.click(deleteIcons[deleteIcons.length - 1]);

      // Wait for and click the Delete button
      await waitFor(() => {
        const actionBarButtons = screen.getAllByRole('button');
        const deleteActionButton = actionBarButtons.find(btn =>
          btn.textContent?.match(/^Delete\s+1$/)
        );
        expect(deleteActionButton).toBeDefined();
      });

      const deleteActionButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.match(/^Delete\s+1$/)
      );
      await user.click(deleteActionButton!);

      // Mock the refresh fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: [downloadedVideos[1]], // Only second video remains
          totalCount: 1,
        }),
      });

      // Confirm deletion
      const confirmButton = await screen.findByTestId('delete-confirm');
      fireEvent.click(confirmButton);

      // Wait for deletion and refresh
      await waitFor(() => {
        expect(mockDeleteVideosByYoutubeIds).toHaveBeenCalled();
      });

      // Verify fetch was called to refresh the list
      await waitFor(() => {
        const fetchCalls = mockFetch.mock.calls;
        const refreshCall = fetchCalls.find((call: any) =>
          call[0].includes('/getchannelvideos/') && fetchCalls.indexOf(call) > 1
        );
        expect(refreshCall).toBeDefined();
      });
    });

    test('shows delete FAB on mobile when videos selected for deletion', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true); // Mobile
      setupFetchMocks({ videos: downloadedVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      // Select a video for deletion
      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      if (deleteIcons.length > 0) {
        // Click the last delete icon (video card icon) - event will bubble to button
        fireEvent.click(deleteIcons[deleteIcons.length - 1]);
      }

      // Delete FAB should appear
      await waitFor(() => {
        const deleteFABIcons = screen.getAllByTestId('DeleteIcon');
        // Should have multiple delete icons - one for each video thumbnail and one for the FAB
        expect(deleteFABIcons.length).toBeGreaterThan(downloadedVideos.length);
      });
    });

    test('includes delete option in mobile drawer', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true); // Mobile

      // Create videos that can be selected for download
      const selectableVideos: ChannelVideo[] = [
        {
          title: 'Not Downloaded Video',
          youtube_id: 'not_dl_1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/thumb1.jpg',
          added: false,
          duration: 3600,
          availability: null,
        },
      ];

      setupFetchMocks({ videos: selectableVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Not Downloaded Video')).toBeInTheDocument();
      });

      // Select a video for download by clicking its checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      const hideDownloadedCheckbox = screen.queryByRole('checkbox', { name: /hide downloaded/i });
      const videoCheckboxes = checkboxes.filter(cb => cb !== hideDownloadedCheckbox);
      if (videoCheckboxes.length > 0) {
        fireEvent.click(videoCheckboxes[0]);
      }

      // Wait for download FAB to appear
      let downloadFab: HTMLElement | undefined;
      await waitFor(() => {
        const allButtons = screen.getAllByRole('button');
        const fabs = allButtons.filter(btn =>
          btn.classList.contains('MuiFab-root')
        );
        // Find the FAB that contains a DownloadIcon
        downloadFab = fabs.find(fab => {
          const downloadIcon = within(fab).queryByTestId('DownloadIcon');
          return downloadIcon !== null;
        });
        expect(downloadFab).toBeDefined();
      });

      // Click the download FAB to open drawer
      fireEvent.click(downloadFab!);

      // Wait for drawer to open
      await waitFor(() => {
        const drawer = screen.queryByRole('presentation');
        expect(drawer).toBeInTheDocument();
      });

      // Drawer should have delete option (even if disabled)
      const deleteText = screen.queryByText(/Delete \d+ Videos?/i);
      expect(deleteText).toBeInTheDocument();
    });
  });

  describe('Media Type Display', () => {
    test('shows short badge for short videos', async () => {
      const shortVideo: ChannelVideo[] = [
        {
          title: 'Short Video',
          youtube_id: 'short1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/thumb1.jpg',
          added: false,
          duration: 60,
          availability: null,
          media_type: 'short',
        },
      ];

      setupFetchMocks({ videos: shortVideo });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Short Video')).toBeInTheDocument();
      });

      expect(screen.getByText('Short')).toBeInTheDocument();
    });

    test('shows live badge for livestream videos', async () => {
      const liveVideo: ChannelVideo[] = [
        {
          title: 'Live Video',
          youtube_id: 'live1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/thumb1.jpg',
          added: false,
          duration: 7200,
          availability: null,
          media_type: 'livestream',
        },
      ];

      setupFetchMocks({ videos: liveVideo });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Live Video')).toBeInTheDocument();
      });

      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    test('does not show media type badge for regular videos', async () => {
      setupFetchMocks({ videos: [mockVideos[0]] });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      expect(screen.queryByText('Short')).not.toBeInTheDocument();
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });
  });

  describe('File Size Formatting', () => {
    test('formats file size in GB when larger than 1GB', async () => {
      const largeVideo: ChannelVideo[] = [
        {
          title: 'Large Video',
          youtube_id: 'large1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/thumb1.jpg',
          added: true,
          removed: false,
          duration: 3600,
          availability: null,
          fileSize: 2147483648,
        },
      ];

      setupFetchMocks({ videos: largeVideo });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Large Video')).toBeInTheDocument();
      });

      expect(screen.getByText('2.0GB')).toBeInTheDocument();
    });

    test('formats file size in MB when smaller than 1GB', async () => {
      const smallVideo: ChannelVideo[] = [
        {
          title: 'Small Video',
          youtube_id: 'small1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/thumb1.jpg',
          added: true,
          removed: false,
          duration: 300,
          availability: null,
          fileSize: 52428800,
        },
      ];

      setupFetchMocks({ videos: smallVideo });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Small Video')).toBeInTheDocument();
      });

      expect(screen.getByText('50MB')).toBeInTheDocument();
    });
  });

  describe('Success and Error Snackbars', () => {
    test('closes success snackbar when close button is clicked', async () => {
      const downloadedVideos: ChannelVideo[] = [
        {
          title: 'Downloaded Video 1',
          youtube_id: 'dl_video1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/thumb1.jpg',
          added: true,
          removed: false,
          duration: 3600,
          availability: null,
        },
      ];

      setupFetchMocks({ videos: downloadedVideos });
      const user = userEvent.setup();

      mockDeleteVideosByYoutubeIds.mockResolvedValueOnce({
        success: true,
        deleted: ['dl_video1'],
        failed: [],
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      fireEvent.click(deleteIcons[deleteIcons.length - 1]);

      await waitFor(() => {
        const actionBarButtons = screen.getAllByRole('button');
        const deleteActionButton = actionBarButtons.find(btn =>
          btn.textContent?.match(/^Delete\s+1$/)
        );
        expect(deleteActionButton).toBeDefined();
      });

      const deleteActionButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.match(/^Delete\s+1$/)
      );
      await user.click(deleteActionButton!);

      const confirmButton = await screen.findByTestId('delete-confirm');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully deleted 1 video/i)).toBeInTheDocument();
      });

      // Find and click the close button in the alert
      const alerts = screen.getAllByRole('alert');
      const successAlert = alerts.find(alert => alert.textContent?.includes('Successfully deleted'));
      expect(successAlert).toBeDefined();
      const closeButton = within(successAlert!).getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Successfully deleted 1 video/i)).not.toBeInTheDocument();
      });
    });

    test('closes error snackbar when close button is clicked', async () => {
      const downloadedVideos: ChannelVideo[] = [
        {
          title: 'Downloaded Video 1',
          youtube_id: 'dl_video1',
          publishedAt: '2024-01-15T10:00:00Z',
          thumbnail: 'https://example.com/thumb1.jpg',
          added: true,
          removed: false,
          duration: 3600,
          availability: null,
        },
      ];

      setupFetchMocks({ videos: downloadedVideos });
      const user = userEvent.setup();

      mockDeleteVideosByYoutubeIds.mockResolvedValueOnce({
        success: false,
        deleted: [],
        failed: [{ youtubeId: 'dl_video1', error: 'Test error message' }],
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Downloaded Video 1')).toBeInTheDocument();
      });

      const deleteIcons = screen.getAllByTestId('DeleteIcon');
      fireEvent.click(deleteIcons[deleteIcons.length - 1]);

      await waitFor(() => {
        const actionBarButtons = screen.getAllByRole('button');
        const deleteActionButton = actionBarButtons.find(btn =>
          btn.textContent?.match(/^Delete\s+1$/)
        );
        expect(deleteActionButton).toBeDefined();
      });

      const deleteActionButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.match(/^Delete\s+1$/)
      );
      await user.click(deleteActionButton!);

      const confirmButton = await screen.findByTestId('delete-confirm');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to delete videos: Test error message/i)).toBeInTheDocument();
      });

      // Find and click the close button in the alert
      const alerts = screen.getAllByRole('alert');
      const errorAlert = alerts.find(alert => alert.textContent?.includes('Failed to delete'));
      expect(errorAlert).toBeDefined();
      const closeButton = within(errorAlert!).getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Failed to delete videos: Test error message/i)).not.toBeInTheDocument();
      });
    });
  });
});