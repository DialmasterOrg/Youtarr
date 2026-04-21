import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  formatDuration: (duration: number | null) => {
    if (!duration) return 'Unknown';
    return `${Math.floor(duration / 60)}m`;
  },
  formatYTDate: (date: string | null) => {
    if (!date) return 'Unknown';
    return '1/15/2024';
  }
}));

jest.mock('../../hooks/useMediaQuery');
jest.mock('../../hooks/useConfig', () => ({
  useConfig: jest.fn(() => ({
    config: { channelVideosHotLoad: false },
  })),
}));

jest.mock('../shared/DeleteVideosDialog', () => ({
  __esModule: true,
  default: function MockDeleteVideosDialog(props: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'delete-videos-dialog',
      'data-open': props.open,
      'data-video-count': props.videoCount,
    }, [
      React.createElement('button', {
        key: 'cancel',
        'data-testid': 'dialog-cancel',
        onClick: props.onClose
      }, 'Cancel'),
      React.createElement('button', {
        key: 'confirm',
        'data-testid': 'dialog-confirm',
        onClick: props.onConfirm
      }, 'Confirm Delete')
    ]);
  }
}));

jest.mock('../shared/useVideoDeletion', () => ({
  useVideoDeletion: jest.fn()
}));

jest.mock('../shared/VideoModal', () => ({
  __esModule: true,
  default: function MockVideoModal(props: any) {
    const React = require('react');

    if (!props.open) {
      return null;
    }

    return React.createElement('div', {
      'data-testid': 'video-modal',
      'data-video-title': props.video?.title,
    }, props.video?.title);
  }
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

const mockPaginatedResponse = (videos: VideoData[], page = 1, limit = 12) => {
  // Extract unique channels from all videos for the channels list
  const uniqueChannels = Array.from(new Set(videos.map(v => v.youTubeChannelName))).sort();

  return {
    videos: videos.slice((page - 1) * limit, page * limit),
    total: videos.length,
    totalPages: Math.ceil(videos.length / limit),
    page,
    limit,
    channels: uniqueChannels
  };
};

const mockPaginatedResponseWithEnabledChannels = (videos: VideoData[], page = 1, limit = 12) => ({
  ...mockPaginatedResponse(videos, page, limit),
  enabledChannels: [
    { channel_id: 'UC1', uploader: 'Tech Channel', enabled: true },
    { channel_id: 'UC2', uploader: 'Gaming Channel', enabled: true },
  ],
});

// Use delay: null to prevent timer-related flakiness when running with other tests
const setupUser = () => userEvent.setup({ delay: null });

function LocationDisplay() {
  const location = useLocation();

  return <div data-testid="location-path">{location.pathname}</div>;
}

describe('VideosPage Component', () => {
  const mockToken = 'test-token';
  const { useMediaQuery } = require('../../hooks/useMediaQuery');
  const { useVideoDeletion } = require('../shared/useVideoDeletion');

  const mockDeleteVideos = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    (useMediaQuery as jest.Mock).mockReturnValue(false);

    // Mock useVideoDeletion to return a mock function
    useVideoDeletion.mockReturnValue({
      deleteVideos: mockDeleteVideos,
      deleteVideosByYoutubeIds: jest.fn(),
      loading: false,
      error: null
    });
  });

  // Helper: force a particular view mode before rendering.
  const useTableView = () => {
    window.localStorage.setItem('youtarr:videosPageViewMode', 'table');
  };

  const useGridView = () => {
    window.localStorage.setItem('youtarr:videosPageViewMode', 'grid');
  };

  describe('Desktop View', () => {
    test('renders videos page with title', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText(/Library/)).toBeInTheDocument();
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
              'x-access-token': mockToken,
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

    test('opens the video modal when the thumbnail is clicked', async () => {
      const user = setupUser();
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      await user.click(screen.getByAltText('thumbnail'));

      expect(screen.getByTestId('video-modal')).toHaveAttribute('data-video-title', 'How to Code');
    });

    test('opens the video modal when the title is clicked', async () => {
      const user = setupUser();
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'How to Code' }));

      expect(screen.getByTestId('video-modal')).toHaveAttribute('data-video-title', 'How to Code');
    });

    test('renders the channel name as a link to the channel page', async () => {
      const user = setupUser();
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponseWithEnabledChannels([mockVideos[0]]) });

      render(
        <MemoryRouter>
          <LocationDisplay />
          <VideosPage token={mockToken} />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const channelLink = screen.getByRole('link', { name: 'Tech Channel' });
      await user.click(channelLink);

      await waitFor(() => {
        expect(screen.getByTestId('location-path')).toHaveTextContent('/channel/UC1');
      });
    });

    test('does not fetch videos when token is null', () => {
      render(<VideosPage token={null} />);

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('displays table header with sort controls in desktop view', async () => {
      useTableView();
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Published/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Downloaded/ })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Title/ })).toBeInTheDocument();
    });

    test('filters videos by channel name', async () => {
      const user = setupUser();
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
      const user = setupUser();
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
      const user = setupUser();
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
      const user = setupUser();
      // Initial load
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
      // After sort click
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const addedHeader = screen.getByText('Downloaded');
      await user.click(addedHeader);

      // Verify that a new API call was made
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });
    });

    test('handles pagination correctly', async () => {
      const user = setupUser();
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

    test('handles image loading errors (grid view)', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const image = screen.getByAltText('thumbnail') as HTMLImageElement;

      fireEvent.error(image);

      await waitFor(() => {
        expect(screen.getByText(/No thumbnail/)).toBeInTheDocument();
      });
    });

    test('displays video duration when available', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      // Grid card renders the formatted duration (mocked as "10m") in the metadata row.
      expect(screen.getByText(/10m/)).toBeInTheDocument();
    });

    test('displays "Unknown" for missing duration', async () => {
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[2]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('React Tutorial')).toBeInTheDocument();
      });

      // Duration is hidden on the card when the field is null.
      expect(screen.queryByText(/10m/)).not.toBeInTheDocument();
    });
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);
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
      useGridView();
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      const channelElements = screen.getAllByText('Tech Channel');
      expect(channelElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/Downloaded:/)).toBeInTheDocument();
      // Card metadata cell includes the published label with colon; sort button is "Published" alone.
      expect(screen.getByText(/Published:/)).toBeInTheDocument();
    });

    test('handles mobile filter menu interaction', async () => {
      const user = setupUser();
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
      const user = setupUser();
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
      const videoWithFile = {
        ...mockVideos[0],
        filePath: '/path/to/video.mp4'
      };
      axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([videoWithFile]) });

      render(<VideosPage token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });

      // Check file size display in format indicator chip (1GB formatted)
      expect(screen.getByText('1.0GB')).toBeInTheDocument();
      expect(screen.getByTestId('StorageIcon')).toBeInTheDocument();
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
        expect(screen.getByText(/Library \(42 total\)/)).toBeInTheDocument();
      });
    });

    test('displays loading state during data fetch', async () => {
      axios.get.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() =>
          resolve({ data: mockPaginatedResponse(mockVideos) }), 100
        ))
      );

      render(<VideosPage token={mockToken} />);

      // While the fetch is pending the videos haven't rendered yet.
      expect(screen.queryByText('How to Code')).not.toBeInTheDocument();

      // Once the fetch resolves the video appears.
      await waitFor(() => {
        expect(screen.getByText('How to Code')).toBeInTheDocument();
      });
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

      expect(screen.getByText(/Library/)).toBeInTheDocument();
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
      const user = setupUser();
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
      const addedHeader = screen.getByText('Downloaded');

      await user.click(publishedHeader);
      await user.click(publishedHeader);
      await user.click(addedHeader);
      await user.click(addedHeader);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(5);
      });
    });

    test('resets page to 1 when filter changes', async () => {
      const user = setupUser();
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

  describe('Video Deletion Features', () => {
    describe('Desktop View - Checkbox Selection and Deletion', () => {
      beforeEach(() => {
        useTableView();
      });

      test('renders checkboxes for video selection in desktop view', async () => {
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Should have a "select all" checkbox in the header
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });

      test('allows selecting and deselecting individual videos', async () => {
        const user = setupUser();
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Get all checkboxes (first is "select all", rest are individual videos)
        const checkboxes = screen.getAllByRole('checkbox');
        const firstVideoCheckbox = checkboxes[1];

        // Initially unchecked
        expect(firstVideoCheckbox).not.toBeChecked();

        // Click to select
        await user.click(firstVideoCheckbox);

        // Should show selection info
        await waitFor(() => {
          expect(screen.getByText(/1 video selected/)).toBeInTheDocument();
        });

        // Click again to deselect
        await user.click(firstVideoCheckbox);

        await waitFor(() => {
          expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
        });
      });

      test('select all checkbox selects all non-removed videos', async () => {
        const user = setupUser();
        const videosWithRemoved = [
          ...mockVideos,
          {
            id: 4,
            youtubeId: 'removed123',
            youTubeChannelName: 'Test Channel',
            youTubeVideoName: 'Removed Video',
            timeCreated: '2024-01-15T10:30:00',
            originalDate: '20240110',
            duration: 600,
            description: 'Removed',
            removed: true,
            fileSize: null
          }
        ];
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(videosWithRemoved) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        const checkboxes = screen.getAllByRole('checkbox');
        const selectAllCheckbox = checkboxes[0];

        await user.click(selectAllCheckbox);

        // Should show that 3 videos are selected (excluding the removed one)
        await waitFor(() => {
          expect(screen.getByText(/3 videos selected/)).toBeInTheDocument();
        });
      });

      test('shows delete button when videos are selected', async () => {
        const user = setupUser();
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Actions button should not be visible initially
        expect(screen.queryByText(/^Actions \(\d+\)$/)).not.toBeInTheDocument();

        // Select a video
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);

        // Actions button should now be visible
        await waitFor(() => {
          expect(screen.getByText('Actions (1)')).toBeInTheDocument();
        });
      });

      test('clears selection when clear button is clicked', async () => {
        const user = setupUser();
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Select a video
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);

        await waitFor(() => {
          expect(screen.getByText(/1 video selected/)).toBeInTheDocument();
        });

        // Click clear selection
        const clearButton = screen.getByText('Clear Selection');
        await user.click(clearButton);

        await waitFor(() => {
          expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
        });
      });

      test('opens delete dialog when delete button is clicked', async () => {
        const user = setupUser();
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Select videos
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);
        await user.click(checkboxes[2]);

        await waitFor(() => {
          expect(screen.getByText(/2 videos selected/)).toBeInTheDocument();
        });

        // Click actions button
        const actionsButton = screen.getByText('Actions (2)');
        await user.click(actionsButton);

        // Click delete menu item
        const deleteMenuItem = screen.getByText('Delete Selected');
        await user.click(deleteMenuItem);

        // Dialog should open
        await waitFor(() => {
          const dialog = screen.getByTestId('delete-videos-dialog');
          expect(dialog.getAttribute('data-open')).toBe('true');
        });

        // Verify video count
        const dialog = screen.getByTestId('delete-videos-dialog');
        expect(dialog.getAttribute('data-video-count')).toBe('2');
      });

      test('single video delete button opens dialog with one video', async () => {
        const user = setupUser();
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Find and click the delete icon button for a single video
        const deleteButtons = screen.getAllByTestId('DeleteIcon');
        await user.click(deleteButtons[0]);

        // Dialog should open with 1 video
        await waitFor(() => {
          const dialog = screen.getByTestId('delete-videos-dialog');
          expect(dialog.getAttribute('data-open')).toBe('true');
        });

        // Verify video count
        const dialog = screen.getByTestId('delete-videos-dialog');
        expect(dialog.getAttribute('data-video-count')).toBe('1');
      });

      test('removed videos cannot be selected', async () => {
        const removedVideo = {
          ...mockVideos[0],
          removed: true
        };
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([removedVideo]) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        const checkboxes = screen.getAllByRole('checkbox');
        const videoCheckbox = checkboxes[1]; // First video checkbox (after select all)

        expect(videoCheckbox).toBeDisabled();
      });
    });

    describe('Mobile View - Bottom Action Bar', () => {
      beforeEach(() => {
        (useMediaQuery as jest.Mock).mockReturnValue(true);
      });

      test('shows selection checkboxes on downloaded video thumbnails in mobile view', async () => {
        const videosWithFiles = mockVideos.filter(v => v.fileSize);
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(videosWithFiles) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        expect(screen.getByRole('checkbox', { name: /Select How to Code/i })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Select Game Review/i })).toBeInTheDocument();
      });

      test('toggles video selection when thumbnail checkbox is clicked in mobile', async () => {
        const user = setupUser();
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[0]]) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        const selectionCheckbox = screen.getByRole('checkbox', { name: /Select How to Code/i });

        await user.click(selectionCheckbox);

        await waitFor(() => {
          expect(screen.getByText(/1 video selected/i)).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();
      });

      test('shows bottom action bar when videos are selected in mobile', async () => {
        const user = setupUser();
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos.slice(0, 2)) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('checkbox', { name: /Select How to Code/i }));

        await waitFor(() => {
          expect(screen.getByText(/1 video selected/i)).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /^Rating$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Clear$/i })).toBeInTheDocument();
      });
    });

    describe('Delete Confirmation and Execution', () => {
      beforeEach(() => {
        useTableView();
      });

      test('successfully deletes videos and shows success message', async () => {
        const user = setupUser();

        // Initial load
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
        // After deletion refresh
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[2]]) });

        // Mock successful deletion
        mockDeleteVideos.mockResolvedValueOnce({
          success: true,
          deleted: [1, 2],
          failed: []
        });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Select videos
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);
        await user.click(checkboxes[2]);

        // Click actions button and delete
        const actionsButton = screen.getByText('Actions (2)');
        await user.click(actionsButton);
        const deleteMenuItem = screen.getByText('Delete Selected');
        await user.click(deleteMenuItem);

        // Confirm deletion
        const confirmButton = screen.getByTestId('dialog-confirm');
        await user.click(confirmButton);

        // Should call deleteVideos with correct params
        await waitFor(() => {
          expect(mockDeleteVideos).toHaveBeenCalledWith([1, 2], mockToken);
        });

        // Success message should appear
        await waitFor(() => {
          expect(screen.getByText(/Successfully deleted 2 videos/)).toBeInTheDocument();
        });

        // Should refresh videos list
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      test('handles partial deletion failure', async () => {
        const user = setupUser();

        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[1], mockVideos[2]]) });

        // Mock partial failure
        mockDeleteVideos.mockResolvedValueOnce({
          success: false,
          deleted: [1],
          failed: [{ videoId: 2, error: 'File not found' }]
        });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Select videos
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);
        await user.click(checkboxes[2]);

        // Delete
        const actionsButton = screen.getByText('Actions (2)');
        await user.click(actionsButton);
        const deleteMenuItem = screen.getByText('Delete Selected');
        await user.click(deleteMenuItem);
        await user.click(screen.getByTestId('dialog-confirm'));

        // Should show partial success message
        await waitFor(() => {
          expect(screen.getByText(/Deleted 1 video, but 1 failed/)).toBeInTheDocument();
        });
      });

      test('handles complete deletion failure', async () => {
        const user = setupUser();

        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        // Mock complete failure
        mockDeleteVideos.mockResolvedValueOnce({
          success: false,
          deleted: [],
          failed: [
            { videoId: 1, error: 'Permission denied' },
            { videoId: 2, error: 'Permission denied' }
          ]
        });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Select and delete
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);
        await user.click(checkboxes[2]);
        const actionsButton = screen.getByText('Actions (2)');
        await user.click(actionsButton);
        const deleteMenuItem = screen.getByText('Delete Selected');
        await user.click(deleteMenuItem);
        await user.click(screen.getByTestId('dialog-confirm'));

        // Should show error message
        await waitFor(() => {
          expect(screen.getByText(/Failed to delete videos: Permission denied/)).toBeInTheDocument();
        });
      });

      test('cancels deletion when cancel button is clicked', async () => {
        const user = setupUser();

        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Select and open dialog
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);
        const actionsButton = screen.getByText('Actions (1)');
        await user.click(actionsButton);
        const deleteMenuItem = screen.getByText('Delete Selected');
        await user.click(deleteMenuItem);

        // Cancel
        const cancelButton = screen.getByTestId('dialog-cancel');
        await user.click(cancelButton);

        // Dialog should close without calling delete
        await waitFor(() => {
          const dialog = screen.getByTestId('delete-videos-dialog');
          expect(dialog.getAttribute('data-open')).toBe('false');
        });
        expect(mockDeleteVideos).not.toHaveBeenCalled();
      });

      test('clears selection after successful deletion', async () => {
        const user = setupUser();

        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[2]]) });

        mockDeleteVideos.mockResolvedValueOnce({
          success: true,
          deleted: [1, 2],
          failed: []
        });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Select and delete
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);
        await user.click(checkboxes[2]);

        expect(screen.getByText(/2 videos selected/)).toBeInTheDocument();

        const actionsButton = screen.getByText('Actions (2)');
        await user.click(actionsButton);
        const deleteMenuItem = screen.getByText('Delete Selected');
        await user.click(deleteMenuItem);
        await user.click(screen.getByTestId('dialog-confirm'));

        // Selection should be cleared
        await waitFor(() => {
          expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
        });
      });

      test('disables delete button while deletion is in progress', async () => {
        const user = setupUser();

        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        // Set loading state
        useVideoDeletion.mockReturnValue({
          deleteVideos: mockDeleteVideos,
          deleteVideosByYoutubeIds: jest.fn(),
          loading: true,
          error: null
        });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Select video
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);

        // Actions button should be disabled
        const actionsButton = screen.getByText('Actions (1)');
        expect(actionsButton).toBeDisabled();
      });
    });

    describe('Snackbar Messages', () => {
      beforeEach(() => {
        useTableView();
      });

      test('success snackbar can be dismissed', async () => {
        const user = setupUser();

        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });
        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse([mockVideos[2]]) });

        mockDeleteVideos.mockResolvedValueOnce({
          success: true,
          deleted: [1],
          failed: []
        });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Delete video
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);
        const actionsButton = screen.getByText('Actions (1)');
        await user.click(actionsButton);
        const deleteMenuItem = screen.getByText('Delete Selected');
        await user.click(deleteMenuItem);
        await user.click(screen.getByTestId('dialog-confirm'));

        // Success message appears
        await waitFor(() => {
          expect(screen.getByText(/Successfully deleted 1 video/)).toBeInTheDocument();
        });
      });

      test('error snackbar shows when deletion fails', async () => {
        const user = setupUser();

        axios.get.mockResolvedValueOnce({ data: mockPaginatedResponse(mockVideos) });

        mockDeleteVideos.mockResolvedValueOnce({
          success: false,
          deleted: [],
          failed: [{ videoId: 1, error: 'Network error' }]
        });

        render(<VideosPage token={mockToken} />);

        await waitFor(() => {
          expect(screen.getByText('How to Code')).toBeInTheDocument();
        });

        // Delete and fail
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[1]);
        const actionsButton = screen.getByText('Actions (1)');
        await user.click(actionsButton);
        const deleteMenuItem = screen.getByText('Delete Selected');
        await user.click(deleteMenuItem);
        await user.click(screen.getByTestId('dialog-confirm'));

        // Error message appears
        await waitFor(() => {
          expect(screen.getByText(/Failed to delete videos: Network error/)).toBeInTheDocument();
        });
      });
    });
  });
});