import React, { useId } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '../../ui';
import { PlaylistWatchedState } from '../../../hooks/usePlaylistDetail';

interface PlaylistWatchedFilterControlProps {
  value: PlaylistWatchedState;
  onChange: (value: PlaylistWatchedState) => void;
  disabled?: boolean;
}

const PlaylistWatchedFilterControl: React.FC<PlaylistWatchedFilterControlProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const labelId = useId();

  return (
    <FormControl style={{ minWidth: 130 }}>
      <InputLabel id={labelId} shrink>
        Watched
      </InputLabel>
      <Select
        labelId={labelId}
        size="small"
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as PlaylistWatchedState)}
      >
        <MenuItem value="all">All</MenuItem>
        <MenuItem value="watched">Watched</MenuItem>
        <MenuItem value="not_watched">Unwatched</MenuItem>
      </Select>
    </FormControl>
  );
};

export default PlaylistWatchedFilterControl;
