import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import MediaServerSyncGroup from './MediaServerSyncGroup';
import { Playlist } from '../../../types/playlist';

const playlist = {
  playlist_id: 'PL1',
  sync_to_plex: true,
  sync_to_jellyfin: false,
  sync_to_emby: false,
  public_on_servers: false,
  sort_order: 'default',
} as unknown as Playlist;

const baseProps = {
  playlist,
  serverStatus: { plex: true, jellyfin: true, emby: false },
  onToggleSync: jest.fn(),
  togglePending: false,
  publicOnServers: false,
  onChangePublic: jest.fn(),
  onSyncNow: jest.fn(),
  onRegenerateM3U: jest.fn(),
  anyConfigured: true,
  actionRunning: false,
};

const renderGroup = (props = {}) =>
  render(
    <MemoryRouter>
      <MediaServerSyncGroup {...baseProps} {...props} />
    </MemoryRouter>
  );

describe('MediaServerSyncGroup', () => {
  test('calls onSyncNow when Sync now is clicked', async () => {
    const user = userEvent.setup();
    const onSyncNow = jest.fn();
    renderGroup({ onSyncNow });
    await user.click(screen.getByRole('button', { name: /Sync now/i }));
    expect(onSyncNow).toHaveBeenCalledTimes(1);
  });

  test('requests a visibility change when the toggle is flipped', async () => {
    const user = userEvent.setup();
    const onChangePublic = jest.fn();
    renderGroup({ onChangePublic });
    await user.click(screen.getByRole('checkbox', { name: /Public on media servers/i }));
    expect(onChangePublic).toHaveBeenCalledTimes(1);
  });

  test('rebuilds the m3u file from the overflow menu', async () => {
    const user = userEvent.setup();
    const onRegenerateM3U = jest.fn();
    renderGroup({ onRegenerateM3U });
    await user.click(screen.getByRole('button', { name: /More playlist actions/i }));
    await user.click(screen.getByText(/Rebuild \.m3u file/i));
    expect(onRegenerateM3U).toHaveBeenCalledTimes(1);
  });

  test('disables Sync now when no servers are configured', () => {
    renderGroup({ anyConfigured: false });
    expect(screen.getByRole('button', { name: /Sync now/i })).toBeDisabled();
  });

  test('shows how many downloads lack a video file on a video-type playlist', () => {
    renderGroup({ unsyncableCount: 3 });
    expect(
      screen.getByText(/3 downloaded items have no video file/i)
    ).toBeInTheDocument();
  });

  test('shows how many downloads lack an MP3 on an MP3 Only playlist', () => {
    renderGroup({
      unsyncableCount: 1,
      playlist: { ...playlist, audio_format: 'mp3_only' },
    });
    expect(
      screen.getByText(/1 downloaded item has no MP3 file/i)
    ).toBeInTheDocument();
  });

  test('shows no mismatch notice when every download matches the playlist type', () => {
    renderGroup({ unsyncableCount: 0 });
    expect(screen.queryByText(/won't appear/i)).not.toBeInTheDocument();
  });

  test('hides the mismatch notice when no media server is configured', () => {
    renderGroup({
      unsyncableCount: 3,
      anyConfigured: false,
      serverStatus: { plex: false, jellyfin: false, emby: false },
    });
    expect(screen.queryByText(/won't appear/i)).not.toBeInTheDocument();
  });

  test('hides the mismatch notice when the playlist has sync disabled everywhere', () => {
    renderGroup({
      unsyncableCount: 3,
      playlist: {
        ...playlist,
        sync_to_plex: false,
        sync_to_jellyfin: false,
        sync_to_emby: false,
      },
    });
    expect(screen.queryByText(/won't appear/i)).not.toBeInTheDocument();
  });

  test('hides the mismatch notice when the only enabled sync targets an unconfigured server', () => {
    // sync_to_plex is on but Plex is no longer configured; Jellyfin is
    // configured but this playlist does not sync to it.
    renderGroup({
      unsyncableCount: 3,
      serverStatus: { plex: false, jellyfin: true, emby: false },
    });
    expect(screen.queryByText(/won't appear/i)).not.toBeInTheDocument();
  });
});
