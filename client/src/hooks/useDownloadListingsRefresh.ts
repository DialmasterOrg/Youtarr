import { useDebouncedCallback } from './useDebouncedCallback';
import { useSocketEvents } from './useSocketEvents';

const REFRESH_DEBOUNCE_MS = 1000;
const LISTING_MESSAGE_TYPES = ['videosUpdated', 'downloadComplete', 'jobsUpdated'];

/**
 * Calls onRefresh (debounced) when a download job is enqueued or starts
 * (jobsUpdated), a download batch persists a video (videosUpdated), a job
 * finishes (downloadComplete), or the connection comes back, so listing pages
 * can refetch without a manual reload.
 */
export function useDownloadListingsRefresh(onRefresh: () => void): void {
  const scheduleRefresh = useDebouncedCallback(onRefresh, REFRESH_DEBOUNCE_MS);
  useSocketEvents(LISTING_MESSAGE_TYPES, scheduleRefresh, scheduleRefresh);
}
