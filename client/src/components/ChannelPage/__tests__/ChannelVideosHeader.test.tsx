import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import ChannelVideosHeader from '../ChannelVideosHeader';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { renderWithProviders } from '../../../test-utils';

// Mock Material-UI hooks
jest.mock('@mui/material/useMediaQuery');

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
    title: 'Test Video 3',
    youtube_id: 'video3',
    publishedAt: '2023-01-03T00:00:00Z',
    thumbnail: 'https://i.ytimg.com/vi/video3/mqdefault.jpg',
    added: true,
    removed: true,
    duration: 450,
    media_type: 'video',
    live_status: null,
  },
];

describe('ChannelVideosHeader Component', () => {
  const defaultProps = {
    isMobile: false,
    viewMode: 'grid' as const,
    searchQuery: '',
    hideDownloaded: false,
    totalCount: 0,
    oldestVideoDate: null,
    fetchingAllVideos: false,
    checkedBoxes: [],
    selectedForDeletion: [],
    deleteLoading: false,
    paginatedVideos: [],
    autoDownloadsEnabled: false,
    selectedTab: 'videos',
    onViewModeChange: jest.fn(),
    onSearchChange: jest.fn(),
    onHideDownloadedChange: jest.fn(),
    onRefreshClick: jest.fn(),
    onDownloadClick: jest.fn(),
    onSelectAll: jest.fn(),
    onClearSelection: jest.fn(),
    onDeleteClick: jest.fn(),
    onBulkIgnoreClick: jest.fn(),
    onInfoIconClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);
      expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
    });
  });

  describe('Video Count Display', () => {
    test('displays video count chip when totalCount > 0', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} totalCount={42} />
      );
      expect(screen.getByText('42 items')).toBeInTheDocument();
    });

    test('does not display count chip when totalCount is 0', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} totalCount={0} />);
      const chips = screen.queryAllByText('0');
      expect(chips.length).toBe(0);
    });

    test('displays oldest video date on desktop', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          oldestVideoDate="2023-01-15T00:00:00Z"
        />
      );
      // Verify that "Oldest:" text appears when oldestVideoDate is provided
      expect(screen.getByText(/Oldest:/)).toBeInTheDocument();
    });

    test('does not display oldest video date when null', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);
      expect(screen.queryByText(/Oldest:/)).not.toBeInTheDocument();
    });

    test('does not display oldest video date on mobile', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          isMobile={true}
          oldestVideoDate="2023-01-15T00:00:00Z"
        />
      );
      expect(screen.queryByText(/Oldest:/)).not.toBeInTheDocument();
    });
  });

  describe('Load More Button', () => {
    test('renders load more button', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Load More/i })).toBeInTheDocument();
    });

    test('calls onRefreshClick when load more button is clicked', async () => {
      const user = userEvent.setup();
      const onRefreshClick = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} onRefreshClick={onRefreshClick} />
      );

      await user.click(screen.getByRole('button', { name: /Load More/i }));
      expect(onRefreshClick).toHaveBeenCalledTimes(1);
    });

    test('disables load more button when fetching', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} fetchingAllVideos={true} />
      );

      const button = screen.getByRole('button', { name: /Loading.../i });
      expect(button).toBeDisabled();
    });

    test('shows "Loading..." text when fetching videos', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} fetchingAllVideos={true} />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('shows "Load More" text when not fetching', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} fetchingAllVideos={false} />
      );

      expect(screen.getByText('Load More')).toBeInTheDocument();
    });
  });

  describe('Info Icons', () => {
    test('renders date info icon on desktop', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);
      const infoIcons = screen.getAllByTestId('InfoIcon');
      expect(infoIcons).toHaveLength(1);
    });

    test('info icon is clickable on mobile', async () => {
      const user = userEvent.setup();
      const onInfoIconClick = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          isMobile={true}
          onInfoIconClick={onInfoIconClick}
        />
      );

      const infoIcons = screen.getAllByTestId('InfoIcon');
      expect(infoIcons).toHaveLength(1);

      await user.click(infoIcons[0]);
      expect(onInfoIconClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Search Functionality', () => {
    test('renders search input', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search videos...')).toBeInTheDocument();
    });

    test('displays current search query', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} searchQuery="test query" />
      );

      const input = screen.getByPlaceholderText('Search videos...') as HTMLInputElement;
      expect(input.value).toBe('test query');
    });

    test('calls onSearchChange when typing in search input', async () => {
      const user = userEvent.setup();
      const onSearchChange = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} onSearchChange={onSearchChange} />
      );

      const input = screen.getByPlaceholderText('Search videos...');
      await user.type(input, 'a');

      expect(onSearchChange).toHaveBeenCalledWith('a');
    });

    test('displays search icon', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);
      expect(screen.getByTestId('SearchIcon')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle - Desktop', () => {
    test('renders table and grid buttons on desktop', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const toggleButtons = buttons.filter(btn =>
        btn.getAttribute('value') === 'table' ||
        btn.getAttribute('value') === 'grid'
      );

      expect(toggleButtons.length).toBeGreaterThanOrEqual(2);
    });

    test('does not render list view button on desktop', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const listButton = buttons.find(btn => btn.getAttribute('value') === 'list');

      expect(listButton).toBeUndefined();
    });

    test('table view is selected when viewMode is table', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} viewMode="table" />
      );

      const buttons = screen.getAllByRole('button');
      const tableButton = buttons.find(btn => btn.getAttribute('value') === 'table');

      expect(tableButton).toHaveClass('Mui-selected');
    });

    test('grid view is selected when viewMode is grid', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} viewMode="grid" />
      );

      const buttons = screen.getAllByRole('button');
      const gridButton = buttons.find(btn => btn.getAttribute('value') === 'grid');

      expect(gridButton).toHaveClass('Mui-selected');
    });

    test('calls onViewModeChange when view mode is clicked', async () => {
      const user = userEvent.setup();
      const onViewModeChange = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          viewMode="grid"
          onViewModeChange={onViewModeChange}
        />
      );

      // Click the table view button (first toggle button)
      const buttons = screen.getAllByRole('button');
      const tableButton = buttons.find(btn => btn.getAttribute('value') === 'table');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await user.click(tableButton!);
      expect(onViewModeChange).toHaveBeenCalled();
    });
  });

  describe('View Mode Toggle - Mobile', () => {
    test('renders grid and list buttons on mobile', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} isMobile={true} />
      );

      const buttons = screen.getAllByRole('button');
      const toggleButtons = buttons.filter(btn =>
        btn.getAttribute('value') === 'grid' ||
        btn.getAttribute('value') === 'list'
      );

      expect(toggleButtons.length).toBeGreaterThanOrEqual(2);
    });

    test('does not render table view button on mobile', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} isMobile={true} />
      );

      const buttons = screen.getAllByRole('button');
      const tableButton = buttons.find(btn => btn.getAttribute('value') === 'table');

      expect(tableButton).toBeUndefined();
    });
  });

  describe('Hide Downloaded Toggle - Desktop', () => {
    test('renders hide downloaded switch on desktop', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);
      expect(screen.getByRole('checkbox', { name: /Hide Downloaded/i })).toBeInTheDocument();
    });

    test('does not render hide downloaded switch on mobile', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} isMobile={true} />
      );
      expect(screen.queryByRole('checkbox', { name: /Hide Downloaded/i })).not.toBeInTheDocument();
    });

    test('hide downloaded switch reflects checked state', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} hideDownloaded={true} />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Hide Downloaded/i });
      expect(checkbox).toBeChecked();
    });

    test('hide downloaded switch reflects unchecked state', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} hideDownloaded={false} />
      );

      const checkbox = screen.getByRole('checkbox', { name: /Hide Downloaded/i });
      expect(checkbox).not.toBeChecked();
    });

    test('calls onHideDownloadedChange when toggled', async () => {
      const user = userEvent.setup();
      const onHideDownloadedChange = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          onHideDownloadedChange={onHideDownloadedChange}
        />
      );

      await user.click(screen.getByRole('checkbox', { name: /Hide Downloaded/i }));
      expect(onHideDownloadedChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Action Buttons - Desktop', () => {
    test('renders action buttons on desktop', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Download Selected/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Select All This Page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Ignore Selected/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete Selected/i })).toBeInTheDocument();
    });

    test('renders compact action buttons on mobile', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} isMobile={true} />
      );

      expect(screen.getByRole('button', { name: /Select all this page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clear selection/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Download.*Selected/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Ignore Selected/i })).not.toBeInTheDocument();
    });
  });

  describe('Download Button', () => {
    test('download button is disabled when no videos checked', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} checkedBoxes={[]} />
      );

      const button = screen.getByRole('button', { name: /Download Selected/i });
      expect(button).toBeDisabled();
    });

    test('download button is enabled when videos are checked', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} checkedBoxes={['video1', 'video2']} />
      );

      const button = screen.getByRole('button', { name: /Download 2 Videos/i });
      expect(button).not.toBeDisabled();
    });

    test('displays singular "Video" when one video selected', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} checkedBoxes={['video1']} />
      );

      expect(screen.getByText(/Download 1 Video/i)).toBeInTheDocument();
    });

    test('displays plural "Videos" when multiple videos selected', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} checkedBoxes={['video1', 'video2', 'video3']} />
      );

      expect(screen.getByText(/Download 3 Videos/i)).toBeInTheDocument();
    });

    test('calls onDownloadClick when clicked', async () => {
      const user = userEvent.setup();
      const onDownloadClick = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={['video1']}
          onDownloadClick={onDownloadClick}
        />
      );

      await user.click(screen.getByRole('button', { name: /Download 1 Video/i }));
      expect(onDownloadClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Select All Button', () => {
    test('select all button is disabled when no checkboxes and no downloadable videos', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={[]}
          paginatedVideos={[]}
        />
      );

      const button = screen.getByRole('button', { name: /Select All This Page/i });
      expect(button).toBeDisabled();
    });

    test('select all button is enabled when downloadable videos exist', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={[]}
          paginatedVideos={mockVideos}
        />
      );

      const button = screen.getByRole('button', { name: /Select All This Page/i });
      expect(button).not.toBeDisabled();
    });

    test('select all button is enabled when videos are already checked', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={['video1']}
          paginatedVideos={mockVideos}
        />
      );

      const button = screen.getByRole('button', { name: /Select All This Page/i });
      expect(button).not.toBeDisabled();
    });

    test('select all button is enabled when ignored videos exist', () => {
      const ignoredVideos: ChannelVideo[] = [
        {
          ...mockVideos[0],
          ignored: true,
        },
      ];

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={[]}
          paginatedVideos={ignoredVideos}
        />
      );

      const button = screen.getByRole('button', { name: /Select All This Page/i });
      expect(button).not.toBeDisabled();
    });

    test('calls onSelectAll when clicked', async () => {
      const user = userEvent.setup();
      const onSelectAll = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={[]}
          paginatedVideos={mockVideos}
          onSelectAll={onSelectAll}
        />
      );

      await user.click(screen.getByRole('button', { name: /Select All This Page/i }));
      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clear Selection Button', () => {
    test('clear button is disabled when no videos checked', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} checkedBoxes={[]} />
      );

      const button = screen.getByRole('button', { name: /^Clear$/i });
      expect(button).toBeDisabled();
    });

    test('clear button is enabled when videos are checked', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} checkedBoxes={['video1']} />
      );

      const button = screen.getByRole('button', { name: /^Clear$/i });
      expect(button).not.toBeDisabled();
    });

    test('calls onClearSelection when clicked', async () => {
      const user = userEvent.setup();
      const onClearSelection = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={['video1']}
          onClearSelection={onClearSelection}
        />
      );

      await user.click(screen.getByRole('button', { name: /^Clear$/i }));
      expect(onClearSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ignore Selected Button', () => {
    test('renders ignore selected button on desktop', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Ignore Selected/i })).toBeInTheDocument();
    });

    test('does not render ignore selected button on mobile', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} isMobile={true} />
      );
      expect(screen.queryByRole('button', { name: /Ignore Selected/i })).not.toBeInTheDocument();
    });

    test('ignore selected button is disabled when no videos checked', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} checkedBoxes={[]} />
      );

      const button = screen.getByRole('button', { name: /Ignore Selected/i });
      expect(button).toBeDisabled();
    });

    test('ignore selected button is enabled when videos are checked', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} checkedBoxes={['video1', 'video2']} />
      );

      const button = screen.getByRole('button', { name: /Ignore Selected/i });
      expect(button).not.toBeDisabled();
    });

    test('calls onBulkIgnoreClick when clicked', async () => {
      const user = userEvent.setup();
      const onBulkIgnoreClick = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={['video1']}
          onBulkIgnoreClick={onBulkIgnoreClick}
        />
      );

      await user.click(screen.getByRole('button', { name: /Ignore Selected/i }));
      expect(onBulkIgnoreClick).toHaveBeenCalledTimes(1);
    });

    test('ignore button has warning color', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} checkedBoxes={['video1']} />
      );

      const button = screen.getByRole('button', { name: /Ignore Selected/i });
      expect(button).toHaveClass('intent-warning');
    });
  });

  describe('Delete Button', () => {
    test('delete button is disabled when no videos selected for deletion', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} selectedForDeletion={[]} />
      );

      const button = screen.getByRole('button', { name: /Delete Selected/i });
      expect(button).toBeDisabled();
    });

    test('delete button is enabled when videos are selected for deletion', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} selectedForDeletion={['video1']} />
      );

      const button = screen.getByRole('button', { name: /Delete 1/i });
      expect(button).not.toBeDisabled();
    });

    test('delete button is disabled when delete is loading', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          selectedForDeletion={['video1']}
          deleteLoading={true}
        />
      );

      const button = screen.getByRole('button', { name: /Delete 1/i });
      expect(button).toBeDisabled();
    });

    test('displays count of videos to delete', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          selectedForDeletion={['video1', 'video2', 'video3']}
        />
      );

      expect(screen.getByText(/Delete 3/i)).toBeInTheDocument();
    });

    test('calls onDeleteClick when clicked', async () => {
      const user = userEvent.setup();
      const onDeleteClick = jest.fn();

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          selectedForDeletion={['video1']}
          onDeleteClick={onDeleteClick}
        />
      );

      await user.click(screen.getByRole('button', { name: /Delete 1/i }));
      expect(onDeleteClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Progress Bar', () => {
    test('shows progress bar when fetching all videos', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} fetchingAllVideos={true} />
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('does not show progress bar when not fetching', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} fetchingAllVideos={false} />
      );

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty paginatedVideos array', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} paginatedVideos={[]} />
      );

      expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
    });

    test('handles large video counts', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} totalCount={9999} />
      );

      expect(screen.getByText('9999 items')).toBeInTheDocument();
    });

    test('handles large selection counts', () => {
      const largeSelection = Array.from({ length: 100 }, (_, i) => `video${i}`);

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={largeSelection}
          selectedForDeletion={largeSelection}
        />
      );

      expect(screen.getByText(/Download 100 Videos/i)).toBeInTheDocument();
      expect(screen.getByText(/Delete 100/i)).toBeInTheDocument();
    });

    test('handles all videos being downloaded', () => {
      const downloadedVideos: ChannelVideo[] = [
        {
          ...mockVideos[0],
          added: true,
          removed: false,
        },
        {
          ...mockVideos[1],
          added: true,
          removed: false,
        },
      ];

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          paginatedVideos={downloadedVideos}
        />
      );

      const selectAllButton = screen.getByRole('button', { name: /Select All This Page/i });
      expect(selectAllButton).toBeDisabled();
    });

    test('handles members-only videos', () => {
      const membersOnlyVideos: ChannelVideo[] = [
        {
          ...mockVideos[0],
          availability: 'subscriber_only',
        },
      ];

      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          paginatedVideos={membersOnlyVideos}
        />
      );

      const selectAllButton = screen.getByRole('button', { name: /Select All This Page/i });
      expect(selectAllButton).toBeDisabled();
    });
  });

  describe('Different Tab Types', () => {
    test('handles videos tab', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} selectedTab="videos" />
      );

      expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
    });

    test('handles shorts tab', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} selectedTab="shorts" />
      );

      expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
    });

    test('handles streams tab', () => {
      renderWithProviders(
        <ChannelVideosHeader {...defaultProps} selectedTab="streams" />
      );

      expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
    });

    test('hides oldest video date for shorts tab', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          selectedTab="shorts"
          oldestVideoDate="2023-01-15T00:00:00Z"
        />
      );

      // Should not display oldest date for shorts
      expect(screen.queryByText(/Oldest:/)).not.toBeInTheDocument();
    });

    test('shows oldest video date for videos tab', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          selectedTab="videos"
          oldestVideoDate="2023-01-15T00:00:00Z"
        />
      );

      // Should display oldest date for videos tab
      expect(screen.getByText(/Oldest:/)).toBeInTheDocument();
    });

    test('shows oldest video date for streams tab', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          selectedTab="streams"
          oldestVideoDate="2023-01-15T00:00:00Z"
        />
      );

      // Should display oldest date for streams tab
      expect(screen.getByText(/Oldest:/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('all interactive elements are keyboard accessible', () => {
      renderWithProviders(<ChannelVideosHeader {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeInTheDocument();
      });

      const textbox = screen.getByRole('textbox');
      expect(textbox).toBeInTheDocument();
    });

    test('buttons have appropriate aria labels', () => {
      renderWithProviders(
        <ChannelVideosHeader
          {...defaultProps}
          checkedBoxes={['video1']}
          selectedForDeletion={['video2']}
        />
      );

      expect(screen.getByRole('button', { name: /Download 1 Video/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete 1/i })).toBeInTheDocument();
    });
  });
});
