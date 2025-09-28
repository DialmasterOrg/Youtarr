import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideosPage from '../VideosPage';
import { VideoData } from '../../types/VideoData';

jest.mock('axios', () => ({
  get: jest.fn()
}));

const axios = require('axios');

jest.mock('react-swipeable', () => ({
  useSwipeable: jest.fn(() => ({}))
}));

jest.mock('../../utils', () => ({
  formatDuration: jest.fn((duration: number | null) => {
    if (!duration) return 'Unknown';
    return `${Math.floor(duration / 60)}m`;
  }),
  formatYTDate: jest.fn((date: string | null) => {
    if (!date) return 'Unknown';
    return '1/15/2024';
  })
}));

jest.mock('@mui/material/useMediaQuery');

jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: () => ({
    breakpoints: {
      down: (breakpoint: string) => false
    }
  })
}));

const mockVideos: VideoData[] = [
  {
    id: 1,
    youtubeId: 'abc123',
    youTubeChannelName: 'Tech Channel',
    youTubeVideoName: 'How to Code',
    timeCreated: '2024-01-15T10:30:00',
    originalDate: '20240110',
    duration: 600,
    description: 'A coding tutorial',
    removed: false,
    fileSize: '1073741824'
  },
  {
    id: 2,
    youtubeId: 'def456',
    youTubeChannelName: 'Gaming Channel',
    youTubeVideoName: 'Game Review',
    timeCreated: '2024-01-14T08:00:00',
    originalDate: '20240108',
    duration: 1200,
    description: 'Game review video',
    removed: false,
    fileSize: '2147483648'
  },
  {
    id: 3,
    youtubeId: 'ghi789',
    youTubeChannelName: 'Tech Channel',
    youTubeVideoName: 'React Tutorial',
    timeCreated: '2024-01-13T14:20:00',
    originalDate: '20240105',
    duration: null,
    description: null,
    removed: false,
    fileSize: null
  }
];

const mockPaginatedResponse = (videos: VideoData[], page = 1, limit = 12) => ({
  videos: videos.slice((page - 1) * limit, page * limit),
  total: videos.length,
  totalPages: Math.ceil(videos.length / limit),
  page,
  limit
});

describe('VideosPage Component', () => {
  const mockToken = 'test-token';
  const useMediaQuery = require('@mui/material/useMediaQuery');

  beforeEach(() => {
    jest.clearAllMocks();
    useMediaQuery.default.mockReturnValue(false);
  });

  describe('Desktop View', () => {
    test('renders videos page with title', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText(/Downloaded Videos/)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });
    });

    test('fetches and displays videos when token is provided', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining('/getVideos?'),
          expect.objectContaining({
            headers: {
              'x-access-token': mockToken
            }
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });
      expect(screen.getByText('Game Review')).toBeInTheDocument();
      expect(screen.getByText('React Tutorial')).toBeInTheDocument();
    });

    test('does not fetch videos when token is null', () => {
      render(<VideosPage token={null} />);

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('displays table headers in desktop view', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('Thumbnail')).toBeInTheDocument();
      });
      expect(screen.getByText('Channel')).toBeInTheDocument();
      expect(screen.getByText('Video Information')).toBeInTheDocument();
      expect(screen.getByText('Published')).toBeInTheDocument();
      expect(screen.getByText('Added')).toBeInTheDocument();
      expect(screen.getByText('File Info')).toBeInTheDocument();
    });

    test('filters videos by channel name', async () => {
      const user = userEvent.setup();
      // First call returns all videos
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
      // Second call returns filtered videos
      const filteredVideos = mockVideos.filter(v => v.youTubeChannelName === 'Tech Channel');
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(filteredVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const filterButtons = screen.getAllByTestId('FilterListIcon');
      await user.click(filterButtons[0]);

      const techChannelOption = screen.getByTestId('filter-menu-Tech Channel');
      await user.click(techChannelOption);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });
      expect(screen.getByText('React Tutorial')).toBeInTheDocument();
      expect(screen.queryByText('Game Review')).not.toBeInTheDocument();
    });

    test('resets filter when "All" is selected', async () => {
      const user = userEvent.setup();
      // Initial load
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
      // After filtering to Tech Channel
      const techVideos = mockVideos.filter(v => v.youTubeChannelName === 'Tech Channel');
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(techVideos) });
      // After resetting filter
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const filterButtons = screen.getAllByTestId('FilterListIcon');
      await user.click(filterButtons[0]);
      await user.click(screen.getByTestId('filter-menu-Tech Channel'));

      await waitFor(() => {
        expect(screen.queryByText('Game Review')).not.toBeInTheDocument();
      });

      await user.click(filterButtons[0]);
      await user.click(screen.getByTestId('filter-menu-all'));

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });
      expect(screen.getByText('Game Review')).toBeInTheDocument();
      expect(screen.getByText('React Tutorial')).toBeInTheDocument();
    });

    test('sorts videos by published date', async () => {
      const user = userEvent.setup();
      // Initial load
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
      // After sort click
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const publishedHeader = screen.getByText('Published');
      await user.click(publishedHeader);

      // Verify that a new API call was made with sort parameters
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });
    });

    test('sorts videos by added date', async () => {
      const user = userEvent.setup();
      // Initial load
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
      // After sort click
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const addedHeader = screen.getByText('Added');
      await user.click(addedHeader);

      // Verify that a new API call was made
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });
    });

    test('handles pagination correctly', async () => {
      const user = userEvent.setup();
      const manyVideos = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        youtubeId: `video${i}`,
        youTubeChannelName: 'Channel',
        youTubeVideoName: `Video ${i}`,
        timeCreated: '2024-01-15T10:30:00',
        originalDate: '20240110',
        duration: 600,
        description: 'Description',
        removed: false,
        fileSize: null
      }));

      // Page 1 response
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(manyVideos, 1, 12) });
      // Page 2 response
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(manyVideos, 2, 12) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('Video 0')).toBeInTheDocument();
      });

      expect(screen.getByText('Video 0')).toBeInTheDocument();
      expect(screen.getByText('Video 11')).toBeInTheDocument();
      expect(screen.queryByText('Video 12')).not.toBeInTheDocument();

      const page2Button = screen.getByRole('button', { name: /go to page 2/i });
      await user.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Video 12')).toBeInTheDocument();
      });
      expect(screen.queryByText('Video 0')).not.toBeInTheDocument();
      expect(screen.getByText('Video 14')).toBeInTheDocument();
    });

    test('handles image loading errors', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const image = screen.getByAltText('thumbnail') as HTMLImageElement;

      fireEvent.error(image);

      await waitFor(() => {
        expect(screen.getByText('No thumbnail')).toBeInTheDocument();
      });
    });

    test('displays video duration when available', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      expect(screen.getByText(/Duration:/)).toBeInTheDocument();
    });

    test('displays "Unknown" for missing duration', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[2]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.queryByText(/Duration:/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      useMediaQuery.default.mockReturnValue(true);
    });

    test('renders mobile layout without table headers', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      expect(screen.queryByText('Thumbnail')).not.toBeInTheDocument();
      expect(screen.queryByText('Video Information')).not.toBeInTheDocument();
    });

    test('displays filter button in mobile view', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /filter by channel/i })).toBeInTheDocument();
      });
    });

    test('shows 6 videos per page in mobile view', async () => {
      const manyVideos = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        youtubeId: `video${i}`,
        youTubeChannelName: 'Channel',
        youTubeVideoName: `Video ${i}`,
        timeCreated: '2024-01-15T10:30:00',
        originalDate: '20240110',
        duration: 600,
        description: 'Description',
        removed: false,
        fileSize: null
      }));

      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(manyVideos, 1, 6) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('Video 0')).toBeInTheDocument();
      });

      expect(screen.getByText('Video 0')).toBeInTheDocument();
      expect(screen.getByText('Video 5')).toBeInTheDocument();
      expect(screen.queryByText('Video 6')).not.toBeInTheDocument();
    });

    test('displays video information in mobile card format', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const channelElements = screen.getAllByText('Tech Channel');
      expect(channelElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Added:/)).toBeInTheDocument();
      expect(screen.getByText(/Published/)).toBeInTheDocument();
    });

    test('handles mobile filter menu interaction', async () => {
      const user = userEvent.setup();
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const filterButton = screen.getByRole('button', { name: /filter by channel/i });
      await user.click(filterButton);

      expect(screen.getByTestId('filter-menu-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Tech Channel')).toBeInTheDocument();
      expect(screen.getByTestId('filter-menu-Gaming Channel')).toBeInTheDocument();
    });
  });

  describe('Search and File Status Features', () => {
    test('displays search bar and allows searching videos', async () => {
      const user = userEvent.setup();
      // Initial load - all videos
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      // Verify all videos are initially shown
      expect(screen.getByText('Game Review')).toBeInTheDocument();
      expect(screen.getByText('React Tutorial')).toBeInTheDocument();

      // After search - only videos with "code" in the name
      const searchResults = mockVideos.filter(v =>
        v.youTubeVideoName.toLowerCase().includes('code')
      );
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(searchResults) });

      const searchInput = screen.getByPlaceholderText(/Search videos/i);
      await user.type(searchInput, 'code');

      // Wait for the filtered results
      await waitFor(() => {
        // Game Review should be gone
        expect(screen.queryByText('Game Review')).not.toBeInTheDocument();
      });

      // How to Code should still be visible
      expect(screen.getByText('How to Code')).toBeInTheDocument();
      // React Tutorial doesn't contain "code" so should not be visible
      expect(screen.queryByText('React Tutorial')).not.toBeInTheDocument();
    });

    test('displays file size information when available', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      // Check file size display (1GB formatted)
      expect(screen.getByText('1.0 GB')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
    });

    test('displays missing file status for removed videos', async () => {
      const removedVideo = {
        ...mockVideos[0],
        removed: true
      };
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([removedVideo]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      expect(screen.getByText('Missing')).toBeInTheDocument();
    });

    test('shows total video count in header', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          ...mockPaginatedResponse(mockVideos),
          total: 42
        }
      });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText(/Downloaded Videos \(42 total\)/)).toBeInTheDocument();
      });
    });

    test('displays loading state during data fetch', async () => {
      axios.get.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() =>
          resolve({ data: mockPaginatedResponse(mockVideos) }), 100
        ))
      );

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('Loading videos...')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });
      expect(screen.queryByText('Loading videos...')).not.toBeInTheDocument();
    });

    test('handles videos with no file size information', async () => {
      const videoNoSize = {
        ...mockVideos[0],
        fileSize: null
      };
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([videoNoSize]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      // Should still show available status if not removed
      expect(screen.queryByText(/GB/)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty video list', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('No videos found')).toBeInTheDocument();
      });
    });

    test('handles API error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      axios.get.mockRejectedValueOnce(new Error('Network error'));

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load videos. Please try refreshing the page. If this error persists, the Youtarr backend may be down.')).toBeInTheDocument();
      });

      expect(screen.getByText(/Downloaded Videos/)).toBeInTheDocument();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch videos:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    test('handles videos without channel names', async () => {
      const videosWithoutChannel = [{
        ...mockVideos[0],
        youTubeChannelName: ''
      }];

      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(videosWithoutChannel) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      expect(screen.getByText('How to Code')).toBeInTheDocument();
    });

    test('handles multiple sort operations', async () => {
      const user = userEvent.setup();
      // Mock multiple API calls for sort operations
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const publishedHeader = screen.getByText('Published');
      const addedHeader = screen.getByText('Added');

      await user.click(publishedHeader);
      await user.click(publishedHeader);
      await user.click(addedHeader);
      await user.click(addedHeader);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(5);
      });
    });

    test('resets page to 1 when filter changes', async () => {
      const user = userEvent.setup();
      const manyVideos = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        youtubeId: `video${i}`,
        youTubeChannelName: i % 2 === 0 ? 'Channel A' : 'Channel B',  // Alternate channels
        youTubeVideoName: `Video ${i}`,
        timeCreated: '2024-01-15T10:30:00',
        originalDate: '20240110',
        duration: 600,
        description: 'Description',
        removed: false,
        fileSize: null
      }));

      // Page 1 initial load - has both Channel A and B
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(manyVideos, 1, 12) });
      // Page 2 navigation - also has both Channel A and B
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(manyVideos, 2, 12) });
      // After filtering to Channel A (should reset to page 1)
      const channelAVideos = manyVideos.filter(v => v.youTubeChannelName === 'Channel A');
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(channelAVideos, 1, 12) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('Video 0')).toBeInTheDocument();
      });

      // Navigate to page 2
      const page2Button = screen.getByRole('button', { name: /go to page 2/i });
      await user.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText('Video 12')).toBeInTheDocument();
      });
      expect(screen.queryByText('Video 0')).not.toBeInTheDocument();

      // Open filter menu and select Channel A
      const filterButtons = screen.getAllByTestId('FilterListIcon');
      await user.click(filterButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('filter-menu-Channel A')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('filter-menu-Channel A'));

      // Should be back on page 1 with only Channel A videos
      await waitFor(() => {
        expect(screen.getByText('Video 0')).toBeInTheDocument();  // First Channel A video
      });
      expect(screen.queryByText('Video 1')).not.toBeInTheDocument(); // Channel B video
    });
  });
});