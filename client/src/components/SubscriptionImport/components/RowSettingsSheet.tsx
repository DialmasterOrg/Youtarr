import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
} from '../../ui';
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
  open, onClose, onOpen: _onOpen, channelId, rowState, dispatch, subfolders, defaultSubfolderDisplay,
}) => {
  const { settings } = rowState;

  const updateSettings = (partial: Partial<RowSettings>) => {
    dispatch({ type: 'UPDATE_ROW_SETTINGS', payload: { channelId, settings: partial } });
  };

  const handleAutoDownloadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ autoDownloadEnabled: event.target.checked });
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle onClose={onClose}>Channel Settings</DialogTitle>
      <DialogContent className="space-y-4">
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

        <FormControl fullWidth>
          <InputLabel id={`sheet-quality-label-${channelId}`}>Video Quality</InputLabel>
          <Select
            labelId={`sheet-quality-label-${channelId}`}
            value={settings.videoQuality ?? ''}
            onChange={handleQualityChange}
            fullWidth
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

        <FormControl fullWidth>
          <InputLabel id={`sheet-rating-label-${channelId}`}>Content Rating</InputLabel>
          <Select
            labelId={`sheet-rating-label-${channelId}`}
            value={settings.defaultRating ?? ''}
            onChange={handleRatingChange}
            fullWidth
          >
            {RATING_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RowSettingsSheet;
