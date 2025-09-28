import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
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
    breakpoints: { down: () => false },
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

// Helper to setup standard fetch mocks
const setupFetchMocks = (videosResponse: any, configResponse: any = { preferredResolution: '1080p' }) => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(videosResponse),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(configResponse),
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
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ videos: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ preferredResolution: '1080p' }),
        });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      expect(screen.getByText('Recent Channel Videos')).toBeInTheDocument();
    });

    test('shows loading skeletons when videos are loading', () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ videos: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ preferredResolution: '1080p' }),
        });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      expect(screen.getByText('Refreshing channel videos — please wait')).toBeInTheDocument();
    });

    test('fetches channel videos with correct parameters', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ videos: mockVideos }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ preferredResolution: '1080p' }),
        });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/getchannelvideos/UC123456',
          {
            headers: {
              'x-access-token': mockToken,
            },
          }
        );
      });
    });

    test('handles null token properly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ videos: mockVideos }),
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={null} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/getchannelvideos/UC123456',
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
        const thumb1 = screen.getByAltText('Thumbnail for video Video Title 1');
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

      const tableRows = screen.getAllByRole('row');
      const downloadedRow = tableRows.find(row =>
        within(row).queryByText('Video Title 2 & More')
      );

      expect(downloadedRow).toBeTruthy();
      expect(downloadedRow).toBeTruthy();
      const checkIcon = within(downloadedRow!).getByTestId('CheckCircleIcon');
      expect(checkIcon).toBeInTheDocument();
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
      setupFetchMocks({ videos: manyVideos });

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
      setupFetchMocks({ videos: manyVideos });

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
      setupFetchMocks({ videos: manyVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
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
        expect(screen.getByLabelText('Hide Downloaded Videos')).toBeInTheDocument();
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

      const checkbox = screen.getByLabelText('Hide Downloaded Videos');
      fireEvent.click(checkbox);

      expect(screen.queryByText('Video Title 2 & More')).not.toBeInTheDocument();
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

      setupFetchMocks({ videos: manyVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });

      const pagination = screen.getByRole('navigation');
      const page2Button = within(pagination).getByText('2');
      fireEvent.click(page2Button);

      const checkbox = screen.getByLabelText('Hide Downloaded Videos');
      fireEvent.click(checkbox);

      // Should reset to page 1 and show non-downloaded videos
      expect(screen.getByText('Video 6')).toBeInTheDocument();
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

      const tableRows = screen.getAllByRole('row');
      const video1Row = tableRows.find(row =>
        within(row).queryByText('Video Title 1')
      );

      expect(video1Row).toBeTruthy();
      const checkbox = within(video1Row!).getByRole('checkbox');
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

      const tableRows = screen.getAllByRole('row');
      const membersOnlyRow = tableRows.find(row =>
        within(row).queryByText('Members Only Video')
      );

      expect(membersOnlyRow).toBeTruthy();
      const checkbox = within(membersOnlyRow!).queryByRole('checkbox');
      expect(checkbox).not.toBeInTheDocument();
      expect(within(membersOnlyRow!).getByText('Members Only')).toBeInTheDocument();
    });
  });

  describe('Bulk Actions', () => {
    test('renders Select All button', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Select All' })).toBeInTheDocument();
      });
    });

    test('selects all undownloaded non-members videos on current page', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const selectAllButton = screen.getByRole('button', { name: 'Select All' });
      fireEvent.click(selectAllButton);

      const tableRows = screen.getAllByRole('row');
      const video1Row = tableRows.find(row =>
        within(row).queryByText('Video Title 1')
      );

      expect(video1Row).toBeTruthy();
      const checkbox = within(video1Row!).getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    test('Clear Selection button clears all selected videos', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const selectAllButton = screen.getByRole('button', { name: 'Select All' });
      fireEvent.click(selectAllButton);

      const clearButton = screen.getByRole('button', { name: 'Clear Selection' });
      fireEvent.click(clearButton);

      const tableRows = screen.getAllByRole('row');
      const video1Row = tableRows.find(row =>
        within(row).queryByText('Video Title 1')
      );

      expect(video1Row).toBeTruthy();
      const checkbox = within(video1Row!).getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    test('Download Selected button shows count of selected videos', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const selectAllButton = screen.getByRole('button', { name: 'Select All' });
      fireEvent.click(selectAllButton);

      expect(screen.getByRole('button', { name: /Download Selected \(1\)/ })).toBeInTheDocument();
    });

    test('triggers download and navigates when Download Selected is clicked', async () => {
      setupFetchMocks({ videos: mockVideos });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({}),
      });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 1')).toBeInTheDocument();
      });

      const selectAllButton = screen.getByRole('button', { name: 'Select All' });
      fireEvent.click(selectAllButton);

      const downloadButton = screen.getByRole('button', { name: /Download Selected/ });
      fireEvent.click(downloadButton);

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

      const selectAllButton = screen.getByRole('button', { name: 'Select All' });
      fireEvent.click(selectAllButton);

      const downloadButton = screen.getByRole('button', { name: /Download Selected/ });
      fireEvent.click(downloadButton);

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

      const selectAllButton = screen.getByRole('button', { name: 'Select All' });
      fireEvent.click(selectAllButton);

      // Should select the missing video but not the downloaded one
      const tableRows = screen.getAllByRole('row');
      const missingRow = tableRows.find(row =>
        within(row).queryByText('Missing Video')
      );

      expect(missingRow).toBeTruthy();
      const checkbox = within(missingRow!).getByRole('checkbox');
      expect(checkbox).toBeChecked();

      // Downloaded video should not have a checkbox
      const downloadedRow = tableRows.find(row =>
        within(row).queryByText('Downloaded Video')
      );
      expect(downloadedRow).toBeTruthy();
      const downloadedCheckbox = within(downloadedRow!).queryByRole('checkbox');
      expect(downloadedCheckbox).not.toBeInTheDocument();
    });

    test('disables buttons when appropriate', async () => {
      setupFetchMocks({ videos: [mockVideos[1]] }); // Only downloaded video

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video Title 2 & More')).toBeInTheDocument();
      });

      const selectAllButton = screen.getByRole('button', { name: 'Select All' });
      const clearButton = screen.getByRole('button', { name: 'Clear Selection' });
      const downloadButton = screen.getByRole('button', { name: /Download Selected/ });

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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ preferredResolution: '1080p' }),
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
      expect(screen.getByText('Refreshing channel videos — please wait')).toBeInTheDocument();
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

      setupFetchMocks({ videos: manyVideos });

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

    test('renders mobile table layout', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video')).toBeInTheDocument(); // Mobile header
      });

      expect(screen.getByText('Added?')).toBeInTheDocument(); // Mobile header
    });

    test('displays mobile tooltip as Snackbar', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Members Only Video')).toBeInTheDocument();
      });

      // Find and click the info icon for members-only video
      const infoButtons = screen.getAllByTestId('InfoIcon');
      fireEvent.click(infoButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Unable to download Members Only/Subscribers Only videos')).toBeInTheDocument();
      });
    });

    test('button widths adapt to mobile view', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        const selectAllButton = screen.getByRole('button', { name: 'Select All' });
        expect(selectAllButton).toHaveStyle({ width: '45%' });
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

      setupFetchMocks({ videos: manyVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
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

      setupFetchMocks({ videos: manyVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Video 1')).toBeInTheDocument();
      });

      // Go to page 2 first
      const pagination = screen.getByRole('navigation');
      const page2Button = within(pagination).getByText('2');
      fireEvent.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Video 17')).toBeInTheDocument();
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

  describe('Info Icons and Tooltips', () => {
    test('shows tooltip on desktop for members-only videos', async () => {
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

      // Tooltips are rendered with title attribute on desktop
      const infoButtons = screen.getAllByTestId('InfoIcon');
      expect(infoButtons.length).toBeGreaterThan(0);
    });

    test('closes mobile tooltip when auto-hide duration expires', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);
      jest.useFakeTimers();

      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Members Only Video')).toBeInTheDocument();
      });

      // Click info icon to show tooltip
      const infoButtons = screen.getAllByTestId('InfoIcon');
      fireEvent.click(infoButtons[0]);

      expect(screen.getByText('Unable to download Members Only/Subscribers Only videos')).toBeInTheDocument();

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(8000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Unable to download Members Only/Subscribers Only videos')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    test('closes mobile tooltip when close button is clicked', async () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);

      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Members Only Video')).toBeInTheDocument();
      });

      // Click info icon to show tooltip
      const infoButtons = screen.getAllByTestId('InfoIcon');
      fireEvent.click(infoButtons[0]);

      expect(screen.getByText('Unable to download Members Only/Subscribers Only videos')).toBeInTheDocument();

      // Click close button
      const closeButton = screen.getByTitle('Close');
      fireEvent.click(closeButton);

      expect(screen.queryByText('Unable to download Members Only/Subscribers Only videos')).not.toBeInTheDocument();
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
    test('applies reduced opacity to members-only video rows', async () => {
      setupFetchMocks({ videos: mockVideos });

      render(
        <BrowserRouter>
          <ChannelVideos token={mockToken} />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Members Only Video')).toBeInTheDocument();
      });

      const tableRows = screen.getAllByRole('row');
      const membersOnlyRow = tableRows.find(row =>
        within(row).queryByText('Members Only Video')
      );

      expect(membersOnlyRow).toBeTruthy();
      expect(membersOnlyRow!).toHaveStyle({ opacity: '0.6' });
    });
  });
});