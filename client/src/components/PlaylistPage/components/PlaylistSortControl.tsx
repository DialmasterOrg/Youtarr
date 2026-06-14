import React, { useId } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '../../ui';
import { PlaylistSortOrder } from '../../../hooks/usePlaylistDetail';

interface PlaylistSortControlProps {
  value: PlaylistSortOrder;
  onChange: (value: PlaylistSortOrder) => void;
  disabled?: boolean;
}

const PlaylistSortControl: React.FC<PlaylistSortControlProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const labelId = useId();

  return (
    <FormControl style={{ minWidth: 160 }}>
      <InputLabel id={labelId} shrink>
        Sort
      </InputLabel>
      <Select
        labelId={labelId}
        size="small"
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as PlaylistSortOrder)}
      >
        <MenuItem value="desc">Newest first</MenuItem>
        <MenuItem value="asc">Oldest first</MenuItem>
      </Select>
    </FormControl>
  );
};

export default PlaylistSortControl;
