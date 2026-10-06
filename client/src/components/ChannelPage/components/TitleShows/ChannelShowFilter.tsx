import React, { useId } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '../../../ui';

const ALL_VIDEOS = 'all';

interface ChannelShowFilterProps {
  /** The channel's active title shows */
  shows: Array<{ id: number; name: string }>;
  /** The show whose episodes are listed, or null for every video */
  value: number | null;
  onChange: (showId: number | null) => void;
  onShowMissing: (showId: number) => void;
}

/** The channel page's show filter: list one title show's episodes, and see what it is missing. */
function ChannelShowFilter({ shows, value, onChange, onShowMissing }: ChannelShowFilterProps) {
  const labelId = useId();
  if (shows.length === 0) return null;
  return (
    <Box className="flex flex-wrap items-end gap-2">
      <FormControl className="min-w-[200px]">
        <InputLabel id={labelId} shrink>Show</InputLabel>
        <Select
          labelId={labelId}
          size="small"
          value={value === null ? ALL_VIDEOS : String(value)}
          onChange={(event) => onChange(event.target.value === ALL_VIDEOS ? null : Number(event.target.value))}
        >
          <MenuItem value={ALL_VIDEOS}>All videos</MenuItem>
          {shows.map((show) => <MenuItem key={show.id} value={String(show.id)}>{show.name}</MenuItem>)}
        </Select>
      </FormControl>
      {value !== null && (
        <Button size="small" variant="outlined" onClick={() => onShowMissing(value)}>Missing episodes</Button>
      )}
    </Box>
  );
}

export default ChannelShowFilter;
