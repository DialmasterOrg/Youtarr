import React from 'react';
import {
  Box, FormControl, InputLabel, MenuItem, Select,
  SwipeableDrawer, Switch, Typography, FormControlLabel,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { RowState, RowSettings } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';
import { QUALITY_OPTIONS, RATING_OPTIONS } from './rowSettingsOptions';
import SubfolderAutocomplete from '../../shared/SubfolderAutocomplete';

interface RowSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  channelId: string;
  rowState: RowState;
  dispatch: React.Dispatch<ImportFlowAction>;
  subfolders: string[];
  defaultSubfolderDisplay: string | null;
}

const RowSettingsSheet: React.FC<RowSettingsSheetProps> = ({
  open, onClose, onOpen, channelId, rowState, dispatch, subfolders, defaultSubfolderDisplay,
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
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={onOpen}
      PaperProps={{
        sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
      }}
    >
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ width: 40, height: 4, bgcolor: 'grey.400', borderRadius: 2, mx: 'auto', mb: 1 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Channel Settings</Typography>

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
          <InputLabel id={`sheet-quality-label-${channelId}`}>Video Quality</InputLabel>
          <Select
            labelId={`sheet-quality-label-${channelId}`}
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
          <InputLabel id={`sheet-rating-label-${channelId}`}>Content Rating</InputLabel>
          <Select
            labelId={`sheet-rating-label-${channelId}`}
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
    </SwipeableDrawer>
  );
};

export default RowSettingsSheet;
