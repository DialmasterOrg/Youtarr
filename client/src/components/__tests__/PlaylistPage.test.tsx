import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PlaylistPage from '../PlaylistPage';
import { renderWithProviders } from '../../test-utils';
import { PlaylistVideo } from '../../types/playlist';

const mockTriggerDownload = jest.fn();
const mockNavigate = jest.fn();
const mockToggleAutoDownload = jest.fn();
const mockMarkVideoDeleted = jest.fn();
const mockRefetchMeta = jest.fn();
const mockIgnoreVideo = jest.fn();
const mockUnignoreVideo = jest.fn();
let mockLocationState: unknown = null;

const mockVideo: PlaylistVideo = {
  id: 1,
  playlist_id: 'PL1',
  youtube_id: 'vidA',
  position: 1,
  added_at: null,
  channel_id: null,
  ignored: false,
  ignored_at: null,
  title: 'Vid A',
  channel_name: 'Chan',
  duration: 60,
  published_at: null,
  thumbnail: null,
  downloaded: false,
  previously_downloaded: false,
  youtube_removed: false,
  video_id: null,
  file_path: null,
  file_size: null,
  audio_file_path: null,
  audio_file_size: null,
};

const mockMissingVideo: PlaylistVideo = {
  ...mockVideo,
  id: 2,
  youtube_id: 'vidB',
  position: 2,
  title: 'Vid B',
  previously_downloaded: true,
};

const mockDownloadedVideo: PlaylistVideo = {
  ...mockVideo,
  id: 3,
  youtube_id: 'vidC',
  position: 3,
  title: 'Vid C',
  downloaded: true,
  file_path: '/data/vidC.mp4',
  file_size: 1024,
};

const mockExcludedVideo: PlaylistVideo = {
  ...mockVideo,
  id: 4,
  youtube_id: 'vidD',
  position: 4,
  title: 'Vid D',
  ignored: true,
};

const mockPlaylist = {
  playlist_id: 'PL1',
  title: 'My Playlist',
  uploader: 'Owner',
  video_count: 1,
  lastFetched: null,
  thumbnail: null,
  public_on_servers: false,
  auto_download: false,
  auto_download_baseline_at: null as string | null,
};

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), isAxiosError: () => false }));
const http = require('axios');

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'PL1' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: '/playlist/PL1',
    search: '',
    hash: '',
    state: mockLocationState,
    key: 'test',
  }),
}));

jest.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({ config: { preferredResolution: '1080' } }),
}));

jest.mock('../DownloadManager/ManualDownload/DownloadSettingsDialog', () => ({
  __esModule: true,
  default: ({
    open,
    onConfirm,
    missingVideoCount,
  }: {
    open: boolean;
    onConfirm: (s: unknown) => void;
    missingVideoCount?: number;
  }) => {
    const React = require('react');
    if (!open) return null;
    return React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { 'data-testid': 'mock-dialog-missing-count' },
        String(missingVideoCount)
      ),
      React.createElement(
        'button',
        { 'data-testid': 'mock-confirm-download', onClick: () => onConfirm(null) },
        'confirm'
      )
    );
  },
}));

jest.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => true, // mobile: cards + a directly-clickable selection action
}));

jest.mock('../../hooks/usePlaylistDetail', () => ({
  usePlaylistDetail: () => ({
    playlist: mockPlaylist,
    videos: [mockVideo, mockMissingVideo, mockDownloadedVideo, mockExcludedVideo],
    notDownloadedCount: 1,
    loading: false,
    loadingMore: false,
    hasMore: false,
    error: null,
    loadMore: jest.fn(),
    refetch: jest.fn(),
    refetchMeta: (...args: unknown[]) => mockRefetchMeta(...args),
    markVideoIgnored: jest.fn(),
    markVideoDeleted: (...args: unknown[]) => mockMarkVideoDeleted(...args),
    refresh: jest.fn(),
    sync: jest.fn(),
    regenerateM3U: jest.fn(),
    triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
  }),
}));

jest.mock('../../hooks/usePlaylistMutations', () => ({
  usePlaylistMutations: () => ({
    pending: false,
    toggleSyncTarget: jest.fn(),
    togglePublic: jest.fn(),
    toggleAutoDownload: (...args: unknown[]) => mockToggleAutoDownload(...args),
    ignoreVideo: (...args: unknown[]) => mockIgnoreVideo(...args),
    unignoreVideo: (...args: unknown[]) => mockUnignoreVideo(...args),
  }),
}));

jest.mock('../../hooks/useMediaServerStatus', () => ({
  useMediaServerStatus: () => ({ status: {}, anyConfigured: true }),
}));

jest.mock('../PlaylistPage/components/PlaylistSyncChips', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../PlaylistPage/components/NoMediaServerWarning', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../PlaylistPage/components/PlaylistSettingsDialog', () => ({
  __esModule: true,
  default: ({ open, onFollowFromNow }: { open: boolean; onFollowFromNow: () => void }) => {
    const React = require('react');
    return open ? React.createElement('button', { onClick: onFollowFromNow }, 'Follow from now...') : null;
  },
}));

jest.mock('../shared/SubscriptionsBackButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../shared/VideoModal', () => ({
  __esModule: true,
  default: ({
    video,
    onVideoDeleted,
  }: {
    video: { youtubeId: string };
    onVideoDeleted?: (ytId: string) => void;
  }) => {
    const React = require('react');
    return React.createElement(
      'button',
      {
        'data-testid': 'mock-modal-delete-video',
        onClick: () => onVideoDeleted?.(video.youtubeId),
      },
      'delete video'
    );
  },
}));

describe('PlaylistPage selected-download selection lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps the selection when the download fails so the user can retry', async () => {
    const user = userEvent.setup();
    mockTriggerDownload.mockRejectedValue(new Error('download blew up'));

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('checkbox', { name: 'Select Vid A' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await user.click(screen.getByTestId('selection-action-download'));
    await user.click(await screen.findByTestId('mock-confirm-download'));

    expect(await screen.findByText('download blew up')).toBeInTheDocument();
    expect(mockTriggerDownload).toHaveBeenCalledWith(['vidA'], undefined);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  test('clears the selection and navigates after a successful download', async () => {
    const user = userEvent.setup();
    mockTriggerDownload.mockResolvedValue(undefined);

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('checkbox', { name: 'Select Vid A' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await user.click(screen.getByTestId('selection-action-download'));
    await user.click(await screen.findByTestId('mock-confirm-download'));

    await waitFor(() => expect(mockTriggerDownload).toHaveBeenCalledWith(['vidA'], undefined));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/downloads/activity'));
    await waitFor(() => expect(screen.queryByText('1 selected')).not.toBeInTheDocument());
  });

  test('Download all opens the dialog and downloads all videos on confirm', async () => {
    const user = userEvent.setup();
    mockTriggerDownload.mockResolvedValue(undefined);

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('button', { name: /Download 1 video/i }));
    await user.click(await screen.findByTestId('mock-confirm-download'));

    await waitFor(() => expect(mockTriggerDownload).toHaveBeenCalledWith(undefined, undefined));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/downloads/activity'));
  });

  test('passes missingVideoCount 1 when a previously-downloaded video is selected', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('checkbox', { name: 'Select Vid B' }));
    await user.click(screen.getByTestId('selection-action-download'));

    expect(await screen.findByTestId('mock-dialog-missing-count')).toHaveTextContent('1');
  });

  test('passes missingVideoCount 0 when only never-downloaded videos are selected', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('checkbox', { name: 'Select Vid A' }));
    await user.click(screen.getByTestId('selection-action-download'));

    expect(await screen.findByTestId('mock-dialog-missing-count')).toHaveTextContent('0');
  });

  test('passes missingVideoCount 0 for Download all even when missing videos exist', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('button', { name: /Download 1 video/i }));

    expect(await screen.findByTestId('mock-dialog-missing-count')).toHaveTextContent('0');
  });

  test('first enable opens following setup instead of silently downloading a batch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlaylistPage token="t" />);
    await user.click(screen.getByRole('checkbox', { name: /Auto-download new videos/i }));
    expect(await screen.findByRole('dialog', { name: 'Start following this playlist' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Only download future additions' })).toBeChecked();
    expect(mockToggleAutoDownload).not.toHaveBeenCalled();
    expect(mockTriggerDownload).not.toHaveBeenCalled();
  });

  test('marks the row deleted in place and refreshes meta when the modal reports a deletion', async () => {
    const user = userEvent.setup();

    renderWithProviders(<PlaylistPage token="t" />);

    // Open the modal by clicking the video card, then delete from the modal.
    await user.click(screen.getByText('Vid A'));
    await user.click(await screen.findByTestId('mock-modal-delete-video'));

    expect(mockMarkVideoDeleted).toHaveBeenCalledWith('vidA');
    expect(mockRefetchMeta).toHaveBeenCalled();
  });

  test('clears the selection when the watched filter changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('checkbox', { name: 'Select Vid A' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText('Watched'));
    await user.click(await screen.findByRole('option', { name: 'Unwatched' }));

    await waitFor(() =>
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
    );
  });

  test('clears the selection when the download filter changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('checkbox', { name: 'Select Vid A' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText('Show'));
    await user.click(await screen.findByRole('option', { name: 'Not downloaded' }));

    await waitFor(() =>
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
    );
  });

  test('renders the sort control defaulting to playlist order', () => {
    renderWithProviders(<PlaylistPage token="t" />);

    const sortControl = screen.getByRole('button', { name: 'Sort' });
    expect(sortControl).toHaveTextContent('Playlist order');
  });
});

describe('PlaylistPage exclude action feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('excluding a not-downloaded video explains the download skip', async () => {
    const user = userEvent.setup();
    mockIgnoreVideo.mockResolvedValue(true);

    renderWithProviders(<PlaylistPage token="t" />);

    // Exclude buttons render in list order: Vid A, Vid B, Vid C (Vid D shows Include).
    await user.click(screen.getAllByRole('button', { name: 'Exclude' })[0]);

    await waitFor(() => expect(mockIgnoreVideo).toHaveBeenCalledWith('PL1', 'vidA'));
    expect(
      await screen.findByText(/won't be auto-downloaded/i)
    ).toBeInTheDocument();
  });

  test('excluding a downloaded video explains the sync removal', async () => {
    const user = userEvent.setup();
    mockIgnoreVideo.mockResolvedValue(true);

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getAllByRole('button', { name: 'Exclude' })[2]);

    await waitFor(() => expect(mockIgnoreVideo).toHaveBeenCalledWith('PL1', 'vidC'));
    expect(
      await screen.findByText(/removed from synced server playlists/i)
    ).toBeInTheDocument();
  });

  test('including a video confirms it is back in the playlist', async () => {
    const user = userEvent.setup();
    mockUnignoreVideo.mockResolvedValue(true);

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('button', { name: 'Include' }));

    await waitFor(() => expect(mockUnignoreVideo).toHaveBeenCalledWith('PL1', 'vidD'));
    expect(
      await screen.findByText(/included in this playlist again/i)
    ).toBeInTheDocument();
  });
});

describe('PlaylistPage video list notices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows a visible note that unavailable videos are excluded from the list', () => {
    renderWithProviders(<PlaylistPage token="t" />);

    expect(
      screen.getByText(/private and deleted videos/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Valid cookies automatically include eligible members-only videos/i)
    ).toBeInTheDocument();
  });
});

describe('PlaylistPage restored-subscription notice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationState = null;
  });

  afterEach(() => {
    mockLocationState = null;
  });

  test('shows a snackbar and clears router state when arriving from a restore', async () => {
    mockLocationState = { restored: true };

    renderWithProviders(<PlaylistPage token="t" />);

    expect(
      await screen.findByText('Playlist restored with its previous settings')
    ).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/playlist/PL1', { replace: true, state: null });
  });

  test('shows no restore notice on a normal visit', () => {
    renderWithProviders(<PlaylistPage token="t" />);

    expect(
      screen.queryByText('Playlist restored with its previous settings')
    ).not.toBeInTheDocument();
  });
});


describe('PlaylistPage following controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlaylist.auto_download = false;
    mockPlaylist.auto_download_baseline_at = '2026-09-01T00:00:00Z';
    mockToggleAutoDownload.mockResolvedValue(true);
    http.get.mockResolvedValue({ data: { candidates: [], selectedIds: [], missingDates: 0 } });
  });

  afterEach(() => {
    mockPlaylist.auto_download = false;
    mockPlaylist.auto_download_baseline_at = null;
    mockLocationState = null;
  });

  test.each([
    [false, true, 'Auto-download resumed; new additions will catch up on scheduled runs.'],
    [true, false, 'Auto-download paused'],
  ])('toggles with an existing baseline from %s to %s', async (current, next, message) => {
    const user = userEvent.setup();
    mockPlaylist.auto_download = current;
    renderWithProviders(<PlaylistPage token="t" />);
    await user.click(screen.getByRole('checkbox', { name: 'Auto-download new videos' }));
    await waitFor(() => expect(mockToggleAutoDownload).toHaveBeenCalledWith('PL1', next));
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Start following this playlist' })).not.toBeInTheDocument();
  });

  test('shows a failure snackbar when a pause or resume cannot be saved', async () => {
    const user = userEvent.setup();
    mockToggleAutoDownload.mockResolvedValue(false);
    renderWithProviders(<PlaylistPage token="t" />);
    await user.click(screen.getByRole('checkbox', { name: 'Auto-download new videos' }));
    expect(await screen.findByText('Could not update auto-download. Please retry.')).toBeVisible();
  });

  test('opens the existing-video chooser from the header', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlaylistPage token="t" />);
    await user.click(screen.getByRole('button', { name: 'Choose existing videos' }));
    expect(await screen.findByRole('dialog', { name: 'Choose existing videos' })).toBeVisible();
    expect(await screen.findByText('No eligible existing videos.')).toBeVisible();
  });

  test('opens reset confirmation from playlist settings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PlaylistPage token="t" />);
    await user.click(screen.getByRole('button', { name: 'Playlist settings' }));
    await user.click(screen.getByRole('button', { name: 'Follow from now...' }));
    expect(await screen.findByRole('dialog', { name: 'Reset starting point?' })).toBeVisible();
    expect(screen.getByText(/Automatic downloads will remain paused/)).toBeVisible();
  });

  test('shows the subscription warning instead of claiming all restored settings were kept', async () => {
    mockLocationState = { restored: true, warning: 'Playlist saved. Auto-download was turned off; retry setup later.' };
    renderWithProviders(<PlaylistPage token="t" />);
    expect(await screen.findByText('Playlist saved. Auto-download was turned off; retry setup later.')).toBeVisible();
    expect(screen.queryByText('Playlist restored with its previous settings')).not.toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/playlist/PL1', { replace: true, state: null });
  });
});
