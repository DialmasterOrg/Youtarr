import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AddPlaylistDialog from '../AddPlaylistDialog';
import { renderWithProviders } from '../../../../test-utils';
import { PlaylistSubscribeResult } from '../../../../hooks/usePlaylistMutations';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../hooks/usePlaylistMutations', () => ({
  usePlaylistMutations: jest.fn(),
}));
jest.mock('../../../../hooks/useMediaServerStatus', () => ({
  useMediaServerStatus: jest.fn(),
}));
jest.mock('../NewPlaylistSettings', () => ({
  __esModule: true,
  default: function MockNewPlaylistSettings({ values, onChange, readOnly }: any) {
    const React = require('react');
    return React.createElement('div', {
      'data-testid': 'new-playlist-settings',
      'data-read-only': readOnly ? 'true' : 'false',
      'data-values': JSON.stringify(values),
    },
      React.createElement('button', {
        onClick: () => onChange({ auto_download: true, video_quality: '720' }),
      }, 'Change settings')
    );
  },
}));

const { usePlaylistMutations } = require('../../../../hooks/usePlaylistMutations');
const { useMediaServerStatus } = require('../../../../hooks/useMediaServerStatus');

const mockFetchPlaylistInfo = jest.fn();
const mockSubscribe = jest.fn();

const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL123';

describe('AddPlaylistDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePlaylistMutations.mockReturnValue({
      fetchPlaylistInfo: mockFetchPlaylistInfo,
      subscribe: mockSubscribe,
      error: null,
      pending: false,
    });
    useMediaServerStatus.mockReturnValue({
      anyConfigured: true,
      status: { plex: true, jellyfin: false, emby: false },
    });
  });

  test('does not fetch while closed', () => {
    renderWithProviders(
      <AddPlaylistDialog open={false} token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />
    );
    expect(mockFetchPlaylistInfo).not.toHaveBeenCalled();
  });

  test('pre-fills the input and auto-fetches when opened with an initialUrl', async () => {
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const input = screen.getByLabelText('YouTube playlist URL') as HTMLInputElement;
    expect(input.value).toBe(PLAYLIST_URL);

    await waitFor(() => {
      expect(mockFetchPlaylistInfo).toHaveBeenCalledWith(PLAYLIST_URL);
    });
    expect(await screen.findByText('My List')).toBeInTheDocument();
  });

  test('does not auto-fetch when opened without an initialUrl', () => {
    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} />);
    expect(mockFetchPlaylistInfo).not.toHaveBeenCalled();
  });

  test('subscribes and navigates to the new playlist after preview', async () => {
    const user = userEvent.setup();
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    mockSubscribe.mockResolvedValue({ playlist: { playlist_id: 'PL123' }, restored: false });

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledWith(PLAYLIST_URL, expect.any(Object));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/playlist/PL123');
  });

  test('navigates with restored state when the subscription restored a soft-deleted playlist', async () => {
    const user = userEvent.setup();
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    mockSubscribe.mockResolvedValue({ playlist: { playlist_id: 'PL123' }, restored: true });

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/playlist/PL123', { state: { restored: true } });
    });
  });

  test.each([false, true])('passes a setup warning to the playlist page (restored=%s)', async (restored) => {
    const user = userEvent.setup();
    const warning = 'Playlist saved. Auto-download setup needs attention.';
    mockFetchPlaylistInfo.mockResolvedValue({ title: 'My List', uploader: 'Me', video_count: 5, thumbnail: '' });
    mockSubscribe.mockResolvedValue({ playlist: { playlist_id: 'PL123' }, restored, warning });
    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);
    await user.click(await screen.findByRole('button', { name: /subscribe/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/playlist/PL123', {
      state: { ...(restored && { restored: true }), warning },
    }));
  });

  test('notifies onSubscribed with the new playlist on success', async () => {
    const user = userEvent.setup();
    const onSubscribed = jest.fn();
    const playlist = { playlist_id: 'PL123' };
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    mockSubscribe.mockResolvedValue({ playlist, restored: false });

    renderWithProviders(
      <AddPlaylistDialog open token="t" onClose={jest.fn()} onSubscribed={onSubscribed} initialUrl={PLAYLIST_URL} />
    );

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    await waitFor(() => {
      expect(onSubscribed).toHaveBeenCalledWith(playlist);
    });
  });

  test('warns when no media server is configured', () => {
    useMediaServerStatus.mockReturnValue({
      anyConfigured: false,
      status: { plex: false, jellyfin: false, emby: false },
    });

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} />);
    expect(screen.getByText(/No media server is currently configured/i)).toBeInTheDocument();
  });

  test('shows an in-flight indicator while the subscribe request is outstanding', async () => {
    const user = userEvent.setup();
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    let resolveSubscribe: (value: PlaylistSubscribeResult | null) => void = () => {};
    const subscribePromise = new Promise<PlaylistSubscribeResult | null>((resolve) => {
      resolveSubscribe = resolve;
    });
    mockSubscribe.mockReturnValue(subscribePromise);

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    expect(await screen.findByRole('button', { name: 'Subscribing...' })).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Fetching the complete playlist from YouTube\. Large playlists can take a minute or two - keep this dialog open\./i
      )
    ).toBeInTheDocument();

    resolveSubscribe(null);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    });
  });

  test('clears the in-flight indicator when the subscribe request fails', async () => {
    const user = userEvent.setup();
    mockFetchPlaylistInfo.mockResolvedValue({
      title: 'My List',
      uploader: 'Me',
      video_count: 5,
      thumbnail: '',
    });
    mockSubscribe.mockResolvedValue(null);

    renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

    const subscribeBtn = await screen.findByRole('button', { name: /subscribe/i });
    await user.click(subscribeBtn);

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });

    expect(await screen.findByRole('button', { name: 'Subscribe' })).toBeInTheDocument();
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Fetching the complete playlist from YouTube/i)
    ).not.toBeInTheDocument();
  });

  describe('settings chosen before subscribing', () => {
    const preview = { title: 'My List', uploader: 'Me', video_count: 5, thumbnail: '', playlist_id: 'PL123' };

    test('starts a new playlist with the default settings', async () => {
      mockFetchPlaylistInfo.mockResolvedValue({ ...preview, existing_subscription: null });

      renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

      const settings = await screen.findByTestId('new-playlist-settings');
      expect(JSON.parse(settings.getAttribute('data-values') || '{}')).toEqual({
        auto_download: false,
        video_quality: null,
        audio_format: null,
        sub_folder: '##USE_GLOBAL_DEFAULT##',
      });
    });

    test('subscribes with the settings the user chose', async () => {
      const user = userEvent.setup();
      mockFetchPlaylistInfo.mockResolvedValue({ ...preview, existing_subscription: null });
      mockSubscribe.mockResolvedValue({ playlist: { playlist_id: 'PL123' }, restored: false });

      renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);
      await user.click(await screen.findByRole('button', { name: 'Change settings' }));
      await user.click(screen.getByRole('button', { name: 'Subscribe' }));

      await waitFor(() => {
        expect(mockSubscribe).toHaveBeenCalledWith(PLAYLIST_URL, {
          sync_to_plex: true,
          sync_to_jellyfin: false,
          sync_to_emby: false,
          auto_download: true,
          video_quality: '720',
          audio_format: null,
          default_sub_folder: '##USE_GLOBAL_DEFAULT##',
        });
      });
    });

    test('shows the saved settings read-only for a previously subscribed playlist', async () => {
      const saved = { auto_download: true, default_sub_folder: 'Music', video_quality: '480', audio_format: 'mp3_only' };
      mockFetchPlaylistInfo.mockResolvedValue({ ...preview, existing_subscription: { enabled: false, settings: saved } });

      renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

      const settings = await screen.findByTestId('new-playlist-settings');
      expect(settings).toHaveAttribute('data-read-only', 'true');
      expect(JSON.parse(settings.getAttribute('data-values') || '{}')).toEqual({
        auto_download: true,
        video_quality: '480',
        audio_format: 'mp3_only',
        sub_folder: 'Music',
      });
      expect(screen.getByText(/restored with its saved settings/)).toBeInTheDocument();
    });

    test('restores a previously subscribed playlist without sending settings', async () => {
      const user = userEvent.setup();
      const saved = { auto_download: false, default_sub_folder: null, video_quality: null, audio_format: null };
      mockFetchPlaylistInfo.mockResolvedValue({ ...preview, existing_subscription: { enabled: false, settings: saved } });
      mockSubscribe.mockResolvedValue({ playlist: { playlist_id: 'PL123' }, restored: true });

      renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);
      await user.click(await screen.findByRole('button', { name: 'Subscribe' }));

      await waitFor(() => {
        expect(mockSubscribe).toHaveBeenCalledWith(PLAYLIST_URL, {
          sync_to_plex: true,
          sync_to_jellyfin: false,
          sync_to_emby: false,
        });
      });
    });

    test('offers to open a playlist that is already subscribed', async () => {
      const user = userEvent.setup();
      const saved = { auto_download: false, default_sub_folder: null, video_quality: null, audio_format: null };
      mockFetchPlaylistInfo.mockResolvedValue({ ...preview, existing_subscription: { enabled: true, settings: saved } });

      renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);

      expect(await screen.findByText(/already subscribed/)).toBeInTheDocument();
      expect(screen.queryByTestId('new-playlist-settings')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Go to playlist' }));

      expect(mockNavigate).toHaveBeenCalledWith('/playlist/PL123');
      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    test('editing the URL drops the previous preview so the next action fetches the new playlist', async () => {
      const user = userEvent.setup();
      const saved = { auto_download: false, default_sub_folder: null, video_quality: null, audio_format: null };
      mockFetchPlaylistInfo.mockResolvedValue({ ...preview, existing_subscription: { enabled: true, settings: saved } });

      renderWithProviders(<AddPlaylistDialog open token="t" onClose={jest.fn()} initialUrl={PLAYLIST_URL} />);
      await screen.findByRole('button', { name: 'Go to playlist' });

      await user.type(screen.getByLabelText('YouTube playlist URL'), 'X');

      expect(screen.queryByRole('button', { name: 'Go to playlist' })).not.toBeInTheDocument();
      expect(screen.queryByText('My List')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fetch info' })).toBeInTheDocument();
    });
  });
});
