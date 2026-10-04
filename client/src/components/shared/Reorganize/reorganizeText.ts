import { ReorganizeWatchState } from '../../../types/reorganize';

export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The singular or plural wording for a count. */
export function agree(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

const SERVER_NAMES: Record<ReorganizeWatchState['serverType'], string> = {
  plex: 'Plex',
  jellyfin: 'Jellyfin',
  emby: 'Emby',
};

export function serverName(serverType: ReorganizeWatchState['serverType']): string {
  return SERVER_NAMES[serverType] || serverType;
}

/** "__TV Shows" for a subfolder, "the main folder" for ''. */
export function folderName(libraryFolder: string): string {
  return libraryFolder ? `__${libraryFolder}` : 'the main folder';
}

export const DOWNLOADS_WAIT_NOTE = 'Downloads wait in the queue until the move finishes.';

export const WATCH_STATE_NOTE = 'Media servers may show moved videos as new, unwatched items. Youtarr keeps its own watched '
  + 'state and restores it on Plex (the server owner), Jellyfin and Emby once they have scanned the moved files. '
  + 'Other Plex accounts keep their history in Youtarr, but not on Plex.';

export const MOVIE_TAGS_NOTE = 'movie tags inside the video file. The NFO files are rewritten, but Plex Personal '
  + 'Media may keep showing the old title.';
