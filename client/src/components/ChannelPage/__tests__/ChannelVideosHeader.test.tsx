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
