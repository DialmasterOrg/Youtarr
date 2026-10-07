import type { LibraryFolderDetail, LibraryLayout } from '../../types/tvShows';

/** The layout preview's example tree and reads-as line (UI 5.7.3), computed without yt-dlp. */

const LAST = '\u2514\u2500 ';
const BRANCH = '\u251c\u2500 ';
const INDENT = '   ';

export interface PreviewExample {
  channelName: string;
  title: string;
  youtubeId: string;
  uploadedAt: Date;
  uploadedAtSource: 'timestamp' | 'upload_date';
  relativePath: string;
  /** A real download (false: the sample) */
  real: boolean;
}

export const SAMPLE_EXAMPLE: PreviewExample = {
  channelName: 'Channel Name', title: 'Video Title', youtubeId: 'aBcD3fGh1jK',
  uploadedAt: new Date('2026-09-28T15:30:00.000Z'), uploadedAtSource: 'timestamp', relativePath: '', real: false,
};

export function exampleFrom(example: LibraryFolderDetail['example']): PreviewExample {
  if (!example) return SAMPLE_EXAMPLE;
  return {
    channelName: example.channelName || SAMPLE_EXAMPLE.channelName,
    title: example.title || SAMPLE_EXAMPLE.title,
    youtubeId: example.youtubeId,
    uploadedAt: example.uploadedAt ? new Date(example.uploadedAt) : SAMPLE_EXAMPLE.uploadedAt,
    uploadedAtSource: example.uploadedAtSource === 'upload_date' ? 'upload_date' : 'timestamp',
    relativePath: example.relativePath,
    real: true,
  };
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function seasonOf(date: Date): string {
  return String(date.getUTCFullYear());
}

/** MMDDHHMM in UTC, the date numbering's episode number. */
export function episodeOf(date: Date): string {
  return `${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
}

export interface PreviewRow {
  prefix: string;
  name: string;
  note?: string;
  kind: 'dir' | 'media' | 'file';
}

// The example's real path, when it has the shape of the layout (a folder can
// hold flat and per-video downloads side by side).
function realSegments(example: PreviewExample, layout: LibraryLayout): string[] | null {
  if (!example.real || !example.relativePath) return null;
  const segments = example.relativePath.split('/').filter(Boolean);
  if (layout === 'tv') return segments.length === 3 ? segments : null;
  return segments.length === 2 || segments.length === 3 ? segments : null;
}

export function previewRows({ folderName, baseName, layout, currentLayout, example, flat }: {
  folderName: string; baseName: string; layout: LibraryLayout; currentLayout: LibraryLayout; example: PreviewExample; flat: boolean;
}): PreviewRow[] {
  const rows: PreviewRow[] = [];
  const root = folderName ? `__${folderName}/` : `${baseName}/`;
  rows.push({ prefix: '', name: root, note: folderName ? 'library folder' : 'downloads folder', kind: 'dir' });
  const real = layout === currentLayout ? realSegments(example, layout) : null;
  if (layout === 'tv') {
    if (!folderName) rows.push({ prefix: BRANCH, name: '.plexignore', note: 'Plex skips __subfolders', kind: 'file' });
    const season = seasonOf(example.uploadedAt);
    const [show, seasonDir, file] = real ?? [
      example.channelName, `Season ${season}`,
      `S${season}E${episodeOf(example.uploadedAt)} - ${example.title} [${example.youtubeId}].mp4`,
    ];
    rows.push({ prefix: LAST, name: `${show}/`, note: 'the show', kind: 'dir' });
    rows.push({ prefix: `${INDENT}${BRANCH}`, name: 'tvshow.nfo, poster.jpg', kind: 'file' });
    rows.push({ prefix: `${INDENT}${LAST}`, name: `${seasonDir}/`, note: 'upload year', kind: 'dir' });
    rows.push({ prefix: `${INDENT}${INDENT}${LAST}`, name: file, note: 'episode number = upload time, plus an .nfo', kind: 'media' });
    return rows;
  }
  const computed = flat
    ? [example.channelName, `${example.channelName} - ${example.title} [${example.youtubeId}].mp4`]
    : [example.channelName, `${example.channelName} - ${example.title} - ${example.youtubeId}`,
      `${example.channelName} - ${example.title} [${example.youtubeId}].mp4`];
  const segments = real ?? computed;
  const channel = segments[0];
  const file = segments[segments.length - 1];
  const videoFolder = segments.length === 3 ? segments[1] : null;
  rows.push({ prefix: LAST, name: `${channel}/`, note: 'the channel', kind: 'dir' });
  if (videoFolder) {
    rows.push({ prefix: `${INDENT}${BRANCH}`, name: 'poster.jpg', kind: 'file' });
    rows.push({ prefix: `${INDENT}${LAST}`, name: `${videoFolder}/`, note: 'one folder per video', kind: 'dir' });
    rows.push({ prefix: `${INDENT}${INDENT}${LAST}`, name: file, note: 'the movie, plus an .nfo', kind: 'media' });
  } else {
    rows.push({ prefix: `${INDENT}${BRANCH}`, name: 'poster.jpg', kind: 'file' });
    rows.push({ prefix: `${INDENT}${LAST}`, name: file, note: 'the movie, plus an .nfo', kind: 'media' });
  }
  return rows;
}

export function readsAs(layout: LibraryLayout, example: PreviewExample): string {
  if (layout === 'videos') return `Shows up as one movie per video, titled "${example.title}".`;
  const date = example.uploadedAt;
  const day = date.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const uploaded = example.uploadedAtSource === 'upload_date'
    ? `uploaded ${day} (no time recorded, read as 00:00 UTC)`
    : `uploaded ${day}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
  return `Shows up as the show ${example.channelName}, Season ${seasonOf(date)}, episode ${episodeOf(date)}: ${uploaded}.`;
}
