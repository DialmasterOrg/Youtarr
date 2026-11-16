import React, { useId } from 'react';
import { FormControl, FormHelperText, InputLabel, MenuItem, Select, SelectChangeEvent } from '../../../ui';
import { ConfigState } from '../../types';

// The resolutions Sonarr and Radarr have a quality for.
const RESOLUTION_OPTIONS = [
  { value: '2160', label: '4K (2160p)' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
];

const LABEL_LIMIT_OPTIONS = [
  { value: '', label: 'Their real resolution' },
  { value: '1080', label: '1080p at most' },
  { value: '720', label: '720p at most' },
  { value: '480', label: '480p at most' },
];

interface ArrBridgeResolutionFieldProps {
  /** arrBridgeResolution; empty follows the preferred resolution. */
  resolution: string;
  /** arrBridgeLabelLimit; empty labels a release with the video's real resolution. */
  labelLimit: string;
  /** The preferredResolution setting, named in the "same as" choice. */
  preferredResolution: string;
  onChange: (updates: Partial<Pick<ConfigState, 'arrBridgeResolution' | 'arrBridgeLabelLimit'>>) => void;
}

/**
 * The resolution grabs are downloaded at, and the highest resolution a
 * release is labeled with.
 */
export const ArrBridgeResolutionField: React.FC<ArrBridgeResolutionFieldProps> = ({
  resolution,
  labelLimit,
  preferredResolution,
  onChange,
}) => {
  const labelId = useId();
  const labelLimitId = useId();

  return (
    <>
      <FormControl fullWidth>
        <InputLabel id={labelId}>Resolution</InputLabel>
        <Select
          labelId={labelId}
          label="Resolution"
          value={resolution}
          onChange={(event: SelectChangeEvent<string>) => onChange({ arrBridgeResolution: event.target.value })}
        >
          <MenuItem value="">Same as Preferred Resolution ({preferredResolution}p)</MenuItem>
          {RESOLUTION_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          Youtarr downloads the best quality up to this resolution. A video that only exists in a lower resolution
          downloads at that, and Sonarr or Radarr show the file&apos;s real quality after import. A video Youtarr
          already has is handed over as it is.
        </FormHelperText>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id={labelLimitId}>Offer releases as</InputLabel>
        <Select
          labelId={labelLimitId}
          label="Offer releases as"
          value={labelLimit}
          onChange={(event: SelectChangeEvent<string>) => onChange({ arrBridgeLabelLimit: event.target.value })}
        >
          {LABEL_LIMIT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          Sonarr and Radarr prefer a higher resolution. A lower label makes them pick Youtarr only when nothing better
          is offered. The video is still downloaded at the resolution above, and they read its real quality when they
          import it.
        </FormHelperText>
      </FormControl>
    </>
  );
};

export default ArrBridgeResolutionField;
