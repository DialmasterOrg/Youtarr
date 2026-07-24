import React from 'react';
import { CalendarToday as CalendarTodayIcon } from '../../../lib/icons';
import { PlaylistVideo } from '../../../types/playlist';

export type PlaylistVideoStatusColor = 'success' | 'default' | 'warning' | 'error';

// Ignored videos stay downloadable: explicitly selecting one is an intentional
// override of the ignore.
export function isDownloadable(v: PlaylistVideo): boolean {
  return !v.downloaded && !v.youtube_removed;
}

// Maps PlaylistVideo's snake_case file fields to the indicator's camelCase props.
export function toDownloadFileProps(v: PlaylistVideo): {
  filePath: string | null;
  audioFilePath: string | null;
  fileSize: number | null;
  audioFileSize: number | null;
  videoResolution: string | null;
} {
  return {
    filePath: v.file_path,
    audioFilePath: v.audio_file_path,
    fileSize: v.file_size,
    audioFileSize: v.audio_file_size,
    videoResolution: v.video_resolution ?? null,
  };
}

export function statusLabel(v: PlaylistVideo): { label: string; color: PlaylistVideoStatusColor } {
  // "Excluded" is the user-facing name for the per-playlist `ignored` flag:
  // left out of this playlist's downloads, server sync, and M3U files.
  if (v.ignored) return { label: 'Excluded', color: 'warning' };
  if (v.youtube_removed) return { label: 'Removed on YT', color: 'error' };
  if (v.downloaded) return { label: 'Downloaded', color: 'success' };
  if (v.previously_downloaded) return { label: 'Missing', color: 'error' };
  return { label: 'Tracked', color: 'default' };
}

export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // yt-dlp / YouTube API dates can be YYYYMMDD; surface those directly rather
  // than letting Date() return Invalid Date.
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? trimmed : d.toLocaleDateString();
}

export const PublishedDate: React.FC<{ value: string | null }> = ({ value }) => {
  const formatted = formatDate(value);
  if (!formatted) {
    return <em className="text-muted-foreground">Unknown</em>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <CalendarTodayIcon size={12} />
      {formatted}
    </span>
  );
};
