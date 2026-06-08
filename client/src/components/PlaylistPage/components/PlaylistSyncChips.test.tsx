import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import PlaylistSyncChips from './PlaylistSyncChips';
import { Playlist, MediaServerStatus } from '../../../types/playlist';

const basePlaylist = {
  playlist_id: 'PL1',
  sync_to_plex: true,
  sync_to_jellyfin: false,
  sync_to_emby: false,
} as unknown as Playlist;

const renderChips = (
  status: MediaServerStatus,
  onToggle = jest.fn()
) =>
  render(
    <MemoryRouter>
      <PlaylistSyncChips playlist={basePlaylist} serverStatus={status} onToggle={onToggle} />
    </MemoryRouter>
  );

describe('PlaylistSyncChips', () => {
  test('toggles an enabled, configured server off when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    renderChips({ plex: true, jellyfin: true, emby: false }, onToggle);

    await user.click(screen.getByRole('button', { name: /Plex/i }));

    expect(onToggle).toHaveBeenCalledWith('plex', false);
  });

  test('renders an unconfigured server as a link to settings', () => {
    renderChips({ plex: true, jellyfin: true, emby: false });

    const embyLink = screen.getByRole('link', { name: /Emby/i });
    expect(embyLink).toHaveAttribute('href', '/settings');
  });
});
