import React, { useId } from 'react';
import { FormControl, FormHelperText, InputLabel, MenuItem, Select, SelectChangeEvent } from '../../../ui';

// The resolutions Sonarr and Radarr have a quality for.
const RESOLUTION_OPTIONS = [
  { value: '2160', label: '4K (2160p)' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
];

interface ArrBridgeResolutionFieldProps {
  /** arrBridgeResolution; empty follows the preferred resolution. */
  value: string;
  /** The preferredResolution setting, named in the "same as" choice. */
  preferredResolution: string;
  onChange: (value: string) => void;
}

/**
 * The resolution grabs are downloaded at and releases are labeled with.
 */
export const ArrBridgeResolutionField: React.FC<ArrBridgeResolutionFieldProps> = ({
  value,
  preferredResolution,
  onChange,
}) => {
  const labelId = useId();

  return (
    <FormControl fullWidth>
      <InputLabel id={labelId}>Resolution</InputLabel>
      <Select
        labelId={labelId}
        label="Resolution"
        value={value}
        onChange={(event: SelectChangeEvent<string>) => onChange(event.target.value)}
      >
        <MenuItem value="">Same as Preferred Resolution ({preferredResolution}p)</MenuItem>
        {RESOLUTION_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>
        Youtarr downloads the best quality up to this resolution and labels the release with it. A video that only
        exists in a lower resolution downloads at that, and Sonarr or Radarr show the file&apos;s real quality after
        import. A video Youtarr already has is handed over as it is.
      </FormHelperText>
    </FormControl>
  );
};

export default ArrBridgeResolutionField;
