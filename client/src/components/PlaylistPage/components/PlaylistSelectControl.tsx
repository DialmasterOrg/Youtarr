import React, { useId } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '../../ui';
import {
  PlaylistDownloadState,
  PlaylistSortOrder,
  PlaylistWatchedState,
} from '../../../hooks/usePlaylistDetail';

export interface PlaylistSelectOption<T extends string> {
  value: T;
  label: string;
}

export const DOWNLOAD_FILTER_OPTIONS: PlaylistSelectOption<PlaylistDownloadState>[] = [
  { value: 'all', label: 'All videos' },
  { value: 'downloaded', label: 'Downloaded' },
  { value: 'not_downloaded', label: 'Not downloaded' },
];

export const WATCHED_FILTER_OPTIONS: PlaylistSelectOption<PlaylistWatchedState>[] = [
  { value: 'all', label: 'All' },
  { value: 'watched', label: 'Watched' },
  { value: 'not_watched', label: 'Unwatched' },
];

export const SORT_OPTIONS: PlaylistSelectOption<PlaylistSortOrder>[] = [
  { value: 'asc', label: 'Playlist order' },
  { value: 'desc', label: 'Reverse playlist order' },
  { value: 'recent', label: 'Recently discovered by Youtarr' },
  { value: 'downloaded', label: 'Recently downloaded' },
  { value: 'published', label: 'Newest published' },
];

const DEFAULT_MIN_WIDTH = 160;
// The watched filter's labels are short, so it takes less room.
export const WATCHED_FILTER_MIN_WIDTH = 130;

interface PlaylistSelectControlProps<T extends string> {
  label: string;
  value: T;
  options: PlaylistSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  minWidth?: number;
}

// One of the small selects above the playlist's video list.
function PlaylistSelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  minWidth = DEFAULT_MIN_WIDTH,
}: PlaylistSelectControlProps<T>) {
  const labelId = useId();

  return (
    <FormControl style={{ minWidth }}>
      <InputLabel id={labelId} shrink>
        {label}
      </InputLabel>
      <Select
        labelId={labelId}
        size="small"
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as T)}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default PlaylistSelectControl;
