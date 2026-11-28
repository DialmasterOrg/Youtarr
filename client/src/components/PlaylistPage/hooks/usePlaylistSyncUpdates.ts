import { useSocketEvents } from '../../../hooks/useSocketEvents';

const SYNC_MESSAGE_TYPES = ['playlistSyncUpdated'];

/**
 * Calls onUpdate when a media server sync of the given playlist starts or
 * ends (playlistSyncUpdated), and after a reconnect, since a sync may have
 * ended while disconnected. playlistDbId is the playlist's database id.
 */
export function usePlaylistSyncUpdates(playlistDbId: number | null, onUpdate: () => void): void {
  useSocketEvents<{ playlistDbId?: number }>(
    SYNC_MESSAGE_TYPES,
    (payload) => {
      if (playlistDbId !== null && payload?.playlistDbId === playlistDbId) onUpdate();
    },
    () => {
      if (playlistDbId !== null) onUpdate();
    }
  );
}
