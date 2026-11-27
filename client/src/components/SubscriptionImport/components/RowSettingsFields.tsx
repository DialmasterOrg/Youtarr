import React, { useId } from 'react';
import {
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

export interface RowSettingsFieldsProps {
  channelId: string;
  rowState: RowState;
  dispatch: React.Dispatch<ImportFlowAction>;
  subfolders: string[];
  createSubfolder: (name: string) => Promise<void>;
  defaultSubfolderDisplay: string | null;
}

// One import row's settings controls, laid out by whichever container shows
// them: the desktop popover or the phone sheet.
const RowSettingsFields: React.FC<RowSettingsFieldsProps> = ({
  channelId, rowState, dispatch, subfolders, createSubfolder, defaultSubfolderDisplay,
}) => {
  const { settings } = rowState;
  const qualityLabelId = useId();
  const ratingLabelId = useId();

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
    <>
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
        <InputLabel id={qualityLabelId}>Video Quality</InputLabel>
        <Select
          labelId={qualityLabelId}
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
        createSubfolder={createSubfolder}
        defaultSubfolderDisplay={defaultSubfolderDisplay}
        label="Subfolder"
      />

      <FormControl fullWidth>
        <InputLabel id={ratingLabelId}>Content Rating</InputLabel>
        <Select
          labelId={ratingLabelId}
          value={settings.defaultRating ?? ''}
          onChange={handleRatingChange}
          fullWidth
        >
          {RATING_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  );
};

export default RowSettingsFields;
