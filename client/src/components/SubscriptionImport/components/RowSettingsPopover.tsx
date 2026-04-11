import React from 'react';
import {
  Box, FormControl, InputLabel, MenuItem, Popover, Select,
  Switch, Typography, FormControlLabel,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { RowState, RowSettings } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';
import { QUALITY_OPTIONS, RATING_OPTIONS } from './rowSettingsOptions';
import SubfolderAutocomplete from '../../shared/SubfolderAutocomplete';

interface RowSettingsPopoverProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  channelId: string;
  rowState: RowState;
  dispatch: React.Dispatch<ImportFlowAction>;
  subfolders: string[];
  defaultSubfolderDisplay: string | null;
}

const RowSettingsPopover: React.FC<RowSettingsPopoverProps> = ({
  anchorEl, open, onClose, channelId, rowState, dispatch, subfolders, defaultSubfolderDisplay,
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

        <SubfolderAutocomplete
          mode="channel"
          value={settings.subFolder}
          onChange={(newValue) => updateSettings({ subFolder: newValue })}
          subfolders={subfolders}
          defaultSubfolderDisplay={defaultSubfolderDisplay}
          label="Subfolder"
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
