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
});
