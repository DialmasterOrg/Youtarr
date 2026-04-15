import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import useMediaQuery from '../../../hooks/useMediaQuery';
import ChannelVideosHeader from '../ChannelVideosHeader';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { renderWithProviders } from '../../../test-utils';

jest.mock('../../../hooks/useMediaQuery');

const mockVideos: ChannelVideo[] = [
  {
    title: 'Not Downloaded',
    youtube_id: 'video-1',
    publishedAt: '2024-01-01T00:00:00Z',
    thumbnail: '',
    added: false,
    removed: false,
    duration: 120,
    media_type: 'video',
    live_status: null,
  },
  {
    title: 'Downloaded',
    youtube_id: 'video-2',
    publishedAt: '2024-01-02T00:00:00Z',
    thumbnail: '',
    added: true,
    removed: false,
    duration: 240,
    media_type: 'video',
    live_status: null,
  },
];

const getDefaultProps = () => ({
  isMobile: false,
  viewMode: 'grid' as const,
  searchQuery: '',
  hideDownloaded: false,
  totalCount: 2,
  oldestVideoDate: null,
  fetchingAllVideos: false,
  checkedBoxes: [] as string[],
  selectedForDeletion: [] as string[],
  deleteLoading: false,
  paginatedVideos: mockVideos,
  autoDownloadsEnabled: false,
  selectedTab: 'videos',
  selectionMode: null as 'download' | 'delete' | null,
  maxRating: 'all',
  onViewModeChange: jest.fn(),
  onSearchChange: jest.fn(),
  onHideDownloadedChange: jest.fn(),
  onRefreshClick: jest.fn(),
  onDownloadClick: jest.fn(),
  onSelectAllDownloaded: jest.fn(),
  onSelectAllNotDownloaded: jest.fn(),
  onClearSelection: jest.fn(),
  onDeleteClick: jest.fn(),
  onBulkIgnoreClick: jest.fn(),
  onInfoIconClick: jest.fn(),
  onMaxRatingChange: jest.fn(),
  onAutoDownloadToggle: jest.fn(),
});

describe('ChannelVideosHeader actions menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('renders desktop Actions control', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} />);
    expect(screen.getByRole('button', { name: /Actions/i })).toBeInTheDocument();
  });

  test('uses desktop filters callback on desktop', async () => {
    const user = userEvent.setup();
    const props = {
      ...getDefaultProps(),
      activeFilterCount: 2,
      filtersExpanded: false,
      onFiltersExpandedChange: jest.fn(),
    };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /filters/i }));

    expect(props.onFiltersExpandedChange).toHaveBeenCalledWith(true);
  });

  test('uses mobile filters callback on mobile', async () => {
    const user = userEvent.setup();
    const props = {
      ...getDefaultProps(),
      isMobile: true,
      activeFilterCount: 1,
      mobileFiltersOpen: false,
      onMobileFiltersOpenChange: jest.fn(),
      onMobileActionsOpenChange: jest.fn(),
    };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /filters/i }));

    expect(props.onMobileActionsOpenChange).toHaveBeenCalledWith(false);
    expect(props.onMobileFiltersOpenChange).toHaveBeenCalledWith(true);
  });

  test('triggers select-all downloaded action from menu', async () => {
    const user = userEvent.setup();
    const props = getDefaultProps();

    renderWithProviders(<ChannelVideosHeader {...props} />);

    const actionsButton = screen.getByRole('button', { name: /Actions/i });
    expect(actionsButton).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(actionsButton);
    expect(actionsButton).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('menuitem', { name: /Select All \(Downloaded\)/i }));

    expect(props.onSelectAllDownloaded).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('triggers select-all not downloaded action from menu', async () => {
    const user = userEvent.setup();
    const props = getDefaultProps();

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Select All \(Not Downloaded\)/i }));

    expect(props.onSelectAllNotDownloaded).toHaveBeenCalledTimes(1);
  });

  test('shows only base actions when there is no selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} />);

    await user.click(screen.getByRole('button', { name: /Actions/i }));

    expect(screen.getByRole('menuitem', { name: /Select All \(Downloaded\)/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Select All \(Not Downloaded\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Clear Selection/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Download Selected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete Selected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Ignore Selected/i })).not.toBeInTheDocument();
  });

  test('toggles actions menu closed when Actions button is clicked again', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} />);

    const actionsButton = screen.getByRole('button', { name: /Actions/i });
    await user.click(actionsButton);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(actionsButton);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('shows and triggers download/ignore menu actions when download selection exists', async () => {
    const user = userEvent.setup();
    const props = {
      ...getDefaultProps(),
      checkedBoxes: ['video-1'],
      selectionMode: 'download' as const,
    };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Actions/i }));

    await user.click(screen.getByRole('menuitem', { name: /Download Selected/i }));
    expect(props.onDownloadClick).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Ignore Selected/i }));
    expect(props.onBulkIgnoreClick).toHaveBeenCalledTimes(1);
  });

  test('shows and triggers delete menu action when delete selection exists', async () => {
    const user = userEvent.setup();
    const props = {
      ...getDefaultProps(),
      selectedForDeletion: ['video-2'],
      selectionMode: 'delete' as const,
    };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Delete Selected/i }));

    expect(props.onDeleteClick).toHaveBeenCalledTimes(1);
  });

  test('triggers clear selection when any selection exists', async () => {
    const user = userEvent.setup();
    const props = {
      ...getDefaultProps(),
      checkedBoxes: ['video-1'],
      selectionMode: 'download' as const,
    };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Clear Selection/i }));

    expect(props.onClearSelection).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('disables select-all downloaded when there are no downloaded videos', async () => {
    const user = userEvent.setup();
    const props = {
      ...getDefaultProps(),
      paginatedVideos: [
        {
          ...mockVideos[0],
          youtube_id: 'video-3',
          added: false,
          removed: false,
        },
      ],
    };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Actions/i }));

    expect(screen.getByRole('menuitem', { name: /Select All \(Downloaded\)/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: /Select All \(Not Downloaded\)/i })).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('disables select-all not downloaded when there are no selectable undownloaded videos', async () => {
    const user = userEvent.setup();
    const props = {
      ...getDefaultProps(),
      paginatedVideos: [
        {
          ...mockVideos[1],
          youtube_id: 'video-4',
          added: true,
          removed: false,
        },
      ],
    };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Actions/i }));

    expect(screen.getByRole('menuitem', { name: /Select All \(Downloaded\)/i })).not.toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: /Select All \(Not Downloaded\)/i })).toHaveAttribute('aria-disabled', 'true');
  });

  test('disables delete action when deleteLoading is true', async () => {
    const user = userEvent.setup();
    const props = {
      ...getDefaultProps(),
      selectedForDeletion: ['video-2'],
      selectionMode: 'delete' as const,
      deleteLoading: true,
    };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Actions/i }));

    expect(screen.getByRole('menuitem', { name: /Delete Selected/i })).toHaveAttribute('aria-disabled', 'true');
  });

  test('does not fire callback when clicking disabled action', async () => {
    const user = userEvent.setup();
    const props = {
      ...getDefaultProps(),
      paginatedVideos: [
        {
          ...mockVideos[0],
          youtube_id: 'video-5',
          added: false,
          removed: false,
        },
      ],
    };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Actions/i }));
    const disabledItem = screen.getByRole('menuitem', { name: /Select All \(Downloaded\)/i });
    expect(disabledItem).toHaveAttribute('aria-disabled', 'true');

    await user.click(disabledItem);
    expect(props.onSelectAllDownloaded).not.toHaveBeenCalled();
  });

  test('hides desktop actions bar on mobile', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} isMobile />);
    expect(screen.queryByTestId('desktop-actions-btn')).not.toBeInTheDocument();
  });

  test('calls onAutoDownloadToggle when auto-download switch is toggled', async () => {
    const user = userEvent.setup();
    const props = getDefaultProps();

    renderWithProviders(<ChannelVideosHeader {...props} autoDownloadsEnabled={false} />);

    const switchEl = screen.getByRole('checkbox', { name: /Enable Channel Downloads/i });
    await user.click(switchEl);

    expect(props.onAutoDownloadToggle).toHaveBeenCalledWith(true);
  });

  test('auto-download switch reflects autoDownloadsEnabled prop', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} autoDownloadsEnabled={true} />);
    const switchEl = screen.getByRole('checkbox', { name: /Enable Channel Downloads/i });
    expect(switchEl).toBeChecked();
  });
});

// Note: prior tests targeting standalone toolbar buttons (Download Selected,
// Select All This Page, Clear, Ignore Selected, Delete Selected) and the
// desktop auto-download InfoIcon were intentionally dropped because those UI
// affordances no longer exist -- selection actions now live inside the Actions
// menu, and the auto-download toggle no longer renders its own InfoIcon on
// desktop. The menu-based equivalents are covered by the "actions menu" suite
// above.

describe('ChannelVideosHeader rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('renders the header container', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} totalCount={0} />);
    expect(screen.getByTestId('channel-videos-header')).toBeInTheDocument();
  });
});

describe('ChannelVideosHeader video count display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('displays video count chip when totalCount > 0', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} totalCount={42} />);
    expect(screen.getByText('42 items')).toBeInTheDocument();
  });

  test('displays singular item label for one video', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} totalCount={1} />);
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  test('does not display count chip when totalCount is 0', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} totalCount={0} />);
    expect(screen.queryByText(/\d+ items?/)).not.toBeInTheDocument();
  });

  test('displays oldest video date on desktop for videos tab', () => {
    renderWithProviders(
      <ChannelVideosHeader
        {...getDefaultProps()}
        oldestVideoDate="2023-01-15T00:00:00Z"
        selectedTab="videos"
      />
    );
    expect(screen.getByText(/Oldest:/)).toBeInTheDocument();
  });

  test('does not display oldest video date when null', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} oldestVideoDate={null} />);
    expect(screen.queryByText(/Oldest:/)).not.toBeInTheDocument();
  });

  test('does not display oldest video date on mobile', () => {
    renderWithProviders(
      <ChannelVideosHeader
        {...getDefaultProps()}
        isMobile
        oldestVideoDate="2023-01-15T00:00:00Z"
      />
    );
    expect(screen.queryByText(/Oldest:/)).not.toBeInTheDocument();
  });

  test('handles large video counts', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} totalCount={9999} />);
    expect(screen.getByText('9999 items')).toBeInTheDocument();
  });
});

describe('ChannelVideosHeader load more button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('renders load more button', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} />);
    expect(screen.getByRole('button', { name: /Load More/i })).toBeInTheDocument();
  });

  test('calls onRefreshClick when load more button is clicked', async () => {
    const user = userEvent.setup();
    const props = getDefaultProps();

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Load More/i }));
    expect(props.onRefreshClick).toHaveBeenCalledTimes(1);
  });

  test('disables load more button when fetching', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} fetchingAllVideos />);
    expect(screen.getByRole('button', { name: /Loading\.\.\./i })).toBeDisabled();
  });

  test('shows Loading text when fetching videos', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} fetchingAllVideos />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('shows Load More text when not fetching', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} fetchingAllVideos={false} />);
    expect(screen.getByText('Load More')).toBeInTheDocument();
  });
});

describe('ChannelVideosHeader auto-download toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('auto-download switch reflects disabled state', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} autoDownloadsEnabled={false} />);
    const checkbox = screen.getByRole('checkbox', { name: /Enable Channel Downloads/i });
    expect(checkbox).not.toBeChecked();
  });
});

describe('ChannelVideosHeader search functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('renders search input', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} />);
    expect(screen.getByPlaceholderText('Search videos...')).toBeInTheDocument();
  });

  test('displays current search query', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} searchQuery="test query" />);
    const input = screen.getByPlaceholderText<HTMLInputElement>('Search videos...');
    expect(input.value).toBe('test query');
  });

  test('calls onSearchChange when typing in search input', async () => {
    const user = userEvent.setup();
    const props = getDefaultProps();

    renderWithProviders(<ChannelVideosHeader {...props} />);

    const input = screen.getByPlaceholderText('Search videos...');
    await user.type(input, 'a');

    expect(props.onSearchChange).toHaveBeenCalledWith('a');
  });

  test('displays search icon', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} />);
    expect(screen.getByTestId('SearchIcon')).toBeInTheDocument();
  });
});

describe('ChannelVideosHeader view mode toggle - desktop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('renders table and grid buttons on desktop', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} />);
    expect(screen.getByRole('button', { name: /Table View/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Grid View/i })).toBeInTheDocument();
  });

  test('does not render list view button on desktop', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} />);
    expect(screen.queryByRole('button', { name: /List View/i })).not.toBeInTheDocument();
  });

  test('calls onViewModeChange when table view is clicked', async () => {
    const user = userEvent.setup();
    const props = { ...getDefaultProps(), viewMode: 'grid' as const };

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('button', { name: /Table View/i }));
    expect(props.onViewModeChange).toHaveBeenCalled();
  });
});

describe('ChannelVideosHeader view mode toggle - mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('renders grid and list buttons on mobile', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} isMobile />);
    expect(screen.getByRole('button', { name: /Grid View/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /List View/i })).toBeInTheDocument();
  });

  test('does not render table view button on mobile', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} isMobile />);
    expect(screen.queryByRole('button', { name: /Table View/i })).not.toBeInTheDocument();
  });
});

describe('ChannelVideosHeader hide downloaded toggle - desktop only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('renders hide downloaded switch on desktop', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} />);
    expect(screen.getByRole('checkbox', { name: /Hide Downloaded/i })).toBeInTheDocument();
  });

  test('does not render hide downloaded switch on mobile', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} isMobile />);
    expect(screen.queryByRole('checkbox', { name: /Hide Downloaded/i })).not.toBeInTheDocument();
  });

  test('hide downloaded switch reflects checked state', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} hideDownloaded />);
    expect(screen.getByRole('checkbox', { name: /Hide Downloaded/i })).toBeChecked();
  });

  test('hide downloaded switch reflects unchecked state', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} hideDownloaded={false} />);
    expect(screen.getByRole('checkbox', { name: /Hide Downloaded/i })).not.toBeChecked();
  });

  test('calls onHideDownloadedChange when toggled', async () => {
    const user = userEvent.setup();
    const props = getDefaultProps();

    renderWithProviders(<ChannelVideosHeader {...props} />);

    await user.click(screen.getByRole('checkbox', { name: /Hide Downloaded/i }));
    expect(props.onHideDownloadedChange).toHaveBeenCalledWith(true);
  });
});

describe('ChannelVideosHeader large selection counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('shows selection count in the Actions button when many videos are selected', () => {
    const largeSelection = Array.from({ length: 100 }, (_, i) => `video${i}`);
    renderWithProviders(
      <ChannelVideosHeader
        {...getDefaultProps()}
        checkedBoxes={largeSelection}
        selectionMode="download"
      />
    );
    expect(screen.getByRole('button', { name: /Actions \(100\)/i })).toBeInTheDocument();
  });

  test('download menu item shows selection count', async () => {
    const user = userEvent.setup();
    const largeSelection = Array.from({ length: 100 }, (_, i) => `video${i}`);

    renderWithProviders(
      <ChannelVideosHeader
        {...getDefaultProps()}
        checkedBoxes={largeSelection}
        selectionMode="download"
      />
    );

    await user.click(screen.getByRole('button', { name: /Actions \(100\)/i }));
    expect(screen.getByRole('menuitem', { name: /Download Selected \(100\)/i })).toBeInTheDocument();
  });

  test('delete menu item shows selection count', async () => {
    const user = userEvent.setup();
    const largeSelection = Array.from({ length: 100 }, (_, i) => `video${i}`);

    renderWithProviders(
      <ChannelVideosHeader
        {...getDefaultProps()}
        selectedForDeletion={largeSelection}
        selectionMode="delete"
      />
    );

    await user.click(screen.getByRole('button', { name: /Actions \(100\)/i }));
    expect(screen.getByRole('menuitem', { name: /Delete Selected \(100\)/i })).toBeInTheDocument();
  });
});

describe('ChannelVideosHeader select-all disabling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('disables Select All (Downloaded) when all paginated videos are not yet downloaded', async () => {
    const user = userEvent.setup();
    const notDownloaded: ChannelVideo[] = [
      { ...mockVideos[0], youtube_id: 'v-a', added: false, removed: false },
      { ...mockVideos[0], youtube_id: 'v-b', added: false, removed: false },
    ];

    renderWithProviders(
      <ChannelVideosHeader {...getDefaultProps()} paginatedVideos={notDownloaded} />
    );

    await user.click(screen.getByRole('button', { name: /Actions/i }));
    expect(screen.getByRole('menuitem', { name: /Select All \(Downloaded\)/i })).toHaveAttribute('aria-disabled', 'true');
  });

  test('disables Select All (Not Downloaded) when every paginated video is already downloaded', async () => {
    const user = userEvent.setup();
    const allDownloaded: ChannelVideo[] = [
      { ...mockVideos[1], youtube_id: 'v-c', added: true, removed: false },
      { ...mockVideos[1], youtube_id: 'v-d', added: true, removed: false },
    ];

    renderWithProviders(
      <ChannelVideosHeader {...getDefaultProps()} paginatedVideos={allDownloaded} />
    );

    await user.click(screen.getByRole('button', { name: /Actions/i }));
    expect(screen.getByRole('menuitem', { name: /Select All \(Not Downloaded\)/i })).toHaveAttribute('aria-disabled', 'true');
  });

  test('disables Select All (Not Downloaded) when paginated videos are members-only', async () => {
    const user = userEvent.setup();
    const membersOnly: ChannelVideo[] = [
      { ...mockVideos[0], youtube_id: 'v-e', added: false, removed: false, availability: 'subscriber_only' },
    ];

    renderWithProviders(
      <ChannelVideosHeader {...getDefaultProps()} paginatedVideos={membersOnly} />
    );

    await user.click(screen.getByRole('button', { name: /Actions/i }));
    expect(screen.getByRole('menuitem', { name: /Select All \(Not Downloaded\)/i })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('ChannelVideosHeader progress bar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('shows progress bar when fetching all videos', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} fetchingAllVideos />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('does not show progress bar when not fetching', () => {
    renderWithProviders(<ChannelVideosHeader {...getDefaultProps()} fetchingAllVideos={false} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('ChannelVideosHeader tab-specific oldest date behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
  });

  test('hides oldest video date for shorts tab', () => {
    renderWithProviders(
      <ChannelVideosHeader
        {...getDefaultProps()}
        selectedTab="shorts"
        oldestVideoDate="2023-01-15T00:00:00Z"
      />
    );
    expect(screen.queryByText(/Oldest:/)).not.toBeInTheDocument();
  });

  test('shows oldest video date for videos tab', () => {
    renderWithProviders(
      <ChannelVideosHeader
        {...getDefaultProps()}
        selectedTab="videos"
        oldestVideoDate="2023-01-15T00:00:00Z"
      />
    );
    expect(screen.getByText(/Oldest:/)).toBeInTheDocument();
  });

  test('shows oldest video date for streams tab', () => {
    renderWithProviders(
      <ChannelVideosHeader
        {...getDefaultProps()}
        selectedTab="streams"
        oldestVideoDate="2023-01-15T00:00:00Z"
      />
    );
    expect(screen.getByText(/Oldest:/)).toBeInTheDocument();
  });
});
