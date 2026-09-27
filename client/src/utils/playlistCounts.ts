import { MAX_PLAYLIST_VIDEOS } from '../components/PlaylistPage/playlistConstants';

const MAX_LABEL = MAX_PLAYLIST_VIDEOS.toLocaleString('en-US');

export const PLAYLIST_DOWNLOADED_NOTE =
  'Downloaded counts only videos whose files are on disk right now. Videos you downloaded and ' +
  "later deleted aren't counted. Download All skips them; select them in the playlist's video " +
  'list to download them again.';

export const PLAYLIST_TOTAL_NOTE =
  "The total leaves out private and members-only entries, which can't be accessed or downloaded. " +
  'Ignored videos count toward the total, and the percentage compares downloaded videos with it.';

export const PLAYLIST_LIMIT_NOTE =
  `Youtarr tracks up to the first ${MAX_LABEL} videos of a playlist, in playlist order. Larger ` +
  `playlists show ${MAX_LABEL}+, and videos past that point aren't listed, downloaded, or ` +
  'synced to media servers.';

// A playlist at the fetch cap may be larger on YouTube. One that lost private
// entries after hitting the cap can sit just under it and is not detected.
export function isPlaylistAtLimit(videoCount: number): boolean {
  return videoCount >= MAX_PLAYLIST_VIDEOS;
}

export function formatVideoTotal(videoCount: number): string {
  return isPlaylistAtLimit(videoCount) ? `${MAX_LABEL}+` : videoCount.toLocaleString();
}

/**
 * Downloaded share of the total, rounded down so 100% means everything is
 * downloaded. Null when there is no meaningful total: an empty playlist, or one
 * at the limit whose real size is unknown.
 */
export function formatDownloadPercent(downloadedCount: number, videoCount: number): string | null {
  if (videoCount <= 0 || isPlaylistAtLimit(videoCount)) return null;
  const percent = Math.min(100, Math.floor((downloadedCount * 100) / videoCount));
  // A few downloads out of hundreds round down to 0, which reads as none.
  if (percent === 0 && downloadedCount > 0) return '<1%';
  return `${percent}%`;
}

// Separate parts so narrow layouts can wrap between them instead of cutting one off.
export function playlistCountParts(videoCount: number, downloadedCount?: number | null): string[] {
  const total = formatVideoTotal(videoCount);
  const videos = `${total} ${videoCount === 1 ? 'video' : 'videos'}`;
  if (typeof downloadedCount !== 'number') return [videos];
  const percent = formatDownloadPercent(downloadedCount, videoCount);
  const downloaded = `${downloadedCount.toLocaleString()} downloaded${percent ? ` (${percent})` : ''}`;
  return [downloaded, videos];
}

export function formatPlaylistCounts(videoCount: number, downloadedCount?: number | null): string {
  return playlistCountParts(videoCount, downloadedCount).join(' • ');
}
