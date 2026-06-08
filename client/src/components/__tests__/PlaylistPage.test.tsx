import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PlaylistPage from '../PlaylistPage';
import { renderWithProviders } from '../../test-utils';
import { PlaylistVideo } from '../../types/playlist';

const mockTriggerDownload = jest.fn();
const mockNavigate = jest.fn();
const mockToggleAutoDownload = jest.fn();

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
  youtube_removed: false,
  video_id: null,
  file_path: null,
  file_size: null,
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
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'PL1' }),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({ config: { preferredResolution: '1080' } }),
}));

jest.mock('../DownloadManager/ManualDownload/DownloadSettingsDialog', () => ({
  __esModule: true,
  default: ({ open, onConfirm }: { open: boolean; onConfirm: (s: unknown) => void }) => {
    const React = require('react');
    if (!open) return null;
    return React.createElement(
      'button',
      { 'data-testid': 'mock-confirm-download', onClick: () => onConfirm(null) },
      'confirm'
    );
  },
}));

jest.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => true, // mobile: cards + a directly-clickable selection action
}));

jest.mock('../../hooks/usePlaylistDetail', () => ({
  usePlaylistDetail: () => ({
    playlist: mockPlaylist,
    videos: [mockVideo],
    notDownloadedCount: 1,
    loading: false,
    error: null,
    refetch: jest.fn(),
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
    ignoreVideo: jest.fn(),
    unignoreVideo: jest.fn(),
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
  default: () => null,
}));

jest.mock('../shared/SubscriptionsBackButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../shared/VideoModal', () => ({
  __esModule: true,
  default: () => null,
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

  test('Download new opens the dialog and downloads all videos on confirm', async () => {
    const user = userEvent.setup();
    mockTriggerDownload.mockResolvedValue(undefined);

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('button', { name: /Download 1 new/i }));
    await user.click(await screen.findByTestId('mock-confirm-download'));

    await waitFor(() => expect(mockTriggerDownload).toHaveBeenCalledWith(undefined, undefined));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/downloads/activity'));
  });

  test('toggling the auto-download switch turns the playlist setting on', async () => {
    const user = userEvent.setup();
    mockToggleAutoDownload.mockResolvedValue({ ...mockPlaylist, auto_download: true });

    renderWithProviders(<PlaylistPage token="t" />);

    await user.click(screen.getByRole('checkbox', { name: /Auto-download new videos/i }));

    await waitFor(() =>
      expect(mockToggleAutoDownload).toHaveBeenCalledWith('PL1', true)
    );
  });
});
