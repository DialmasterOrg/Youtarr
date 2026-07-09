import React, { useId } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '../../ui';
import { PlaylistDownloadState } from '../../../hooks/usePlaylistDetail';

interface PlaylistDownloadFilterControlProps {
  value: PlaylistDownloadState;
  onChange: (value: PlaylistDownloadState) => void;
  disabled?: boolean;
}

const PlaylistDownloadFilterControl: React.FC<PlaylistDownloadFilterControlProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const labelId = useId();

  return (
    <FormControl style={{ minWidth: 160 }}>
      <InputLabel id={labelId} shrink>
        Show
      </InputLabel>
      <Select
        labelId={labelId}
        size="small"
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as PlaylistDownloadState)}
      >
        <MenuItem value="all">All videos</MenuItem>
        <MenuItem value="downloaded">Downloaded</MenuItem>
        <MenuItem value="not_downloaded">Not downloaded</MenuItem>
      </Select>
    </FormControl>
  );
};

export default PlaylistDownloadFilterControl;
