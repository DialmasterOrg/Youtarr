import React from 'react';
import {
  Box, FormControl, InputLabel, MenuItem, Popover, Select,
  Switch, TextField, Typography, FormControlLabel,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { RowState, RowSettings } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';

interface RowSettingsPopoverProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  channelId: string;
  rowState: RowState;
  dispatch: React.Dispatch<ImportFlowAction>;
}

const QUALITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Use global default' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '1440p', label: '1440p' },
  { value: '2160p', label: '2160p' },
  { value: 'best', label: 'best' },
];

const DOWNLOAD_TYPE_OPTIONS: Array<{ value: RowSettings['downloadType']; label: string }> = [
  { value: 'videos', label: 'Videos' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'livestreams', label: 'Livestreams' },
];

const RATING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Use global default' },
  { value: 'G', label: 'G' },
  { value: 'PG', label: 'PG' },
  { value: 'PG-13', label: 'PG-13' },
  { value: 'R', label: 'R' },
  { value: 'NC-17', label: 'NC-17' },
];

const RowSettingsPopover: React.FC<RowSettingsPopoverProps> = ({
  anchorEl, open, onClose, channelId, rowState, dispatch,
}) => {
  const { settings } = rowState;

  const updateSettings = (partial: Partial<RowSettings>) => {
    dispatch({ type: 'UPDATE_ROW_SETTINGS', payload: { channelId, settings: partial } });
  };

  const handleAutoDownloadChange = (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    updateSettings({ autoDownloadEnabled: checked });
  };

  const handleQualityChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    updateSettings({ videoQuality: value === '' ? null : value });
  };

  const handleDownloadTypeChange = (event: SelectChangeEvent<string>) => {
    updateSettings({ downloadType: event.target.value as RowSettings['downloadType'] });
  };

  const handleSubFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateSettings({ subFolder: value === '' ? null : value });
  };

  const handleRatingChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    updateSettings({ defaultRating: value === '' ? null : value });
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
    >
      <Box sx={{ p: 2, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="subtitle2">Channel Settings</Typography>

        <FormControlLabel
          control={
            <Switch
              checked={settings.autoDownloadEnabled}
              onChange={handleAutoDownloadChange}
              inputProps={{ 'aria-label': 'Auto-download enabled' }}
            />
          }
          label="Auto-download enabled"
        />

        <FormControl size="small" fullWidth>
          <InputLabel id={`quality-label-${channelId}`}>Video Quality</InputLabel>
          <Select
            labelId={`quality-label-${channelId}`}
            label="Video Quality"
            value={settings.videoQuality ?? ''}
            onChange={handleQualityChange}
          >
            {QUALITY_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel id={`download-type-label-${channelId}`}>Download Type</InputLabel>
          <Select
            labelId={`download-type-label-${channelId}`}
            label="Download Type"
            value={settings.downloadType}
            onChange={handleDownloadTypeChange}
          >
            {DOWNLOAD_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Subfolder"
          placeholder="Use global default"
          value={settings.subFolder ?? ''}
          onChange={handleSubFolderChange}
          fullWidth
        />

        <FormControl size="small" fullWidth>
          <InputLabel id={`rating-label-${channelId}`}>Content Rating</InputLabel>
          <Select
            labelId={`rating-label-${channelId}`}
            label="Content Rating"
            value={settings.defaultRating ?? ''}
            onChange={handleRatingChange}
          >
            {RATING_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Popover>
  );
};

export default RowSettingsPopover;
