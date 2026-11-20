import { act, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlaylistSyncStatus from '../PlaylistSyncStatus';
import { Playlist, PlaylistSyncStatus as SyncStatus } from '../../../../types/playlist';

const NOW = new Date('2026-11-18T12:00:00Z');

const playlist = {
  playlist_id: 'PL1',
  sync_to_plex: true,
  sync_to_jellyfin: true,
  sync_to_emby: false,
} as unknown as Playlist;

const allServers = { plex: true, jellyfin: true, emby: true };

const renderStatus = (syncStatus: SyncStatus | null, props = {}) =>
  render(
    <PlaylistSyncStatus
      playlist={playlist}
      serverStatus={allServers}
      syncStatus={syncStatus}
      {...props}
    />
  );

const row = (server: string) =>
  within(screen.getByRole('list', { name: 'Sync status' })).getByRole('listitem', { name: server });

describe('PlaylistSyncStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('says how long ago each server last synced', () => {
    renderStatus({
      syncing: false,
      servers: {
        plex: { last_synced_at: '2026-11-18T11:55:00Z', last_error: null },
        jellyfin: { last_synced_at: '2026-11-18T09:00:00Z', last_error: null },
      },
    });

    expect(row('Plex')).toHaveTextContent('Synced 5 min ago');
    expect(row('Jellyfin')).toHaveTextContent('Synced 3 hours ago');
  });

  test('shows the reason when the last sync changed nothing on a server', () => {
    renderStatus({
      syncing: false,
      servers: {
        jellyfin: {
          last_synced_at: null,
          last_error: 'Downloaded video files were not found on Jellyfin.',
        },
      },
    });

    expect(row('Jellyfin')).toHaveTextContent('Not synced');
    expect(row('Jellyfin')).toHaveTextContent('Downloaded video files were not found on Jellyfin.');
    expect(row('Jellyfin')).not.toHaveTextContent('Last synced');
  });

  test('adds the last successful sync to a not-synced server that synced before', () => {
    renderStatus({
      syncing: false,
      servers: {
        jellyfin: {
          last_synced_at: '2026-11-15T12:00:00Z',
          last_error: 'Jellyfin not reachable or not responding.',
        },
      },
    });

    expect(row('Jellyfin')).toHaveTextContent('Not synced');
    expect(row('Jellyfin')).toHaveTextContent('Last synced 3 days ago');
  });

  test('says a server with no recorded sync has not synced yet', () => {
    renderStatus({ syncing: false, servers: {} });

    expect(row('Plex')).toHaveTextContent('Not synced yet');
  });

  test('shows a sync in progress instead of the last result', () => {
    renderStatus({
      syncing: true,
      servers: {
        plex: { last_synced_at: null, last_error: 'No downloaded items to sync yet.' },
      },
    });

    expect(row('Plex')).toHaveTextContent('Syncing...');
    expect(row('Plex')).not.toHaveTextContent('No downloaded items');
  });

  test('lists only servers that are connected and turned on for the playlist', () => {
    renderStatus(
      {
        syncing: false,
        servers: { emby: { last_synced_at: '2026-11-18T11:00:00Z', last_error: null } },
      },
      { serverStatus: { plex: true, jellyfin: false, emby: true } }
    );

    const items = within(screen.getByRole('list', { name: 'Sync status' })).getAllByRole('listitem');
    // Jellyfin is on for the playlist but not connected; Emby is connected but off.
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAccessibleName('Plex');
  });

  test('renders nothing when the playlist syncs to no connected server', () => {
    renderStatus(
      { syncing: false, servers: {} },
      { serverStatus: { plex: false, jellyfin: false, emby: false } }
    );

    expect(screen.queryByRole('list', { name: 'Sync status' })).not.toBeInTheDocument();
  });

  test('renders nothing until the sync status has loaded', () => {
    renderStatus(null);

    expect(screen.queryByRole('list', { name: 'Sync status' })).not.toBeInTheDocument();
  });

  test('keeps the age current while the page stays open', () => {
    renderStatus({
      syncing: false,
      servers: { plex: { last_synced_at: '2026-11-18T11:59:30Z', last_error: null } },
    });
    expect(row('Plex')).toHaveTextContent('Synced just now');

    act(() => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(row('Plex')).toHaveTextContent('Synced 10 min ago');
  });
});
