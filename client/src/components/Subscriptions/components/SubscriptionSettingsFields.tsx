import React from 'react';
import { Typography } from '../../ui';
import { useSubfolders } from '../../../hooks/useSubfolders';
import { useLibraryFolders } from '../../../hooks/useLibraryFolders';
import { effectiveLibraryFolder } from '../../../utils/libraryLayouts';
import { SubfolderAutocomplete } from '../../shared/SubfolderAutocomplete';
import { ResolutionSelect } from '../../shared/ResolutionSelect';
import { AudioFormatSelect } from '../../shared/AudioFormatSelect';

export interface SubscriptionSettingsValues {
  video_quality: string | null;
  audio_format: string | null;
  sub_folder: string | null;
}

interface SubscriptionSettingsFieldsProps {
  token: string | null;
  values: SubscriptionSettingsValues;
  onChange: (patch: Partial<SubscriptionSettingsValues>) => void;
  globalQuality: string;
  defaultSubfolder: string | null;
  subfolderLabel: string;
  subfolderHelperText: string;
  /** Extra helper text appended when MP3 Only is chosen. */
  mp3OnlyHint?: string;
  disabled?: boolean;
  /** Note under the folder picker that a TV folder saves the subscription as a TV show (channels). */
  showTvShowCaption?: boolean;
}

const MP3_HELPER_TEXT = 'MP3 files are saved at 192kbps in the same folder as videos.';
const TV_SHOW_CAPTION = 'Saved as a TV show (season folders and episode NFO files).';

/** Quality, download type, and subfolder pickers shared by the Add Channel and Add Playlist dialogs. */
const SubscriptionSettingsFields: React.FC<SubscriptionSettingsFieldsProps> = ({
  token,
  values,
  onChange,
  globalQuality,
  defaultSubfolder,
  subfolderLabel,
  subfolderHelperText,
  mp3OnlyHint = '',
  disabled = false,
  showTvShowCaption = false,
}) => {
  const { subfolders, loading: subfoldersLoading, createSubfolder } = useSubfolders(token);
  const { layoutOf } = useLibraryFolders(token);
  const isTvFolder = layoutOf(effectiveLibraryFolder(values.sub_folder, defaultSubfolder)) === 'tv';

  return (
    <div className="flex flex-col gap-4">
      <ResolutionSelect
        label="Video Quality"
        emptyLabel={`Using Global Setting (${globalQuality}p)`}
        value={values.video_quality}
        onChange={(value) => onChange({ video_quality: value })}
        disabled={disabled}
      />
      <AudioFormatSelect
        value={values.audio_format}
        onChange={(value) => onChange({ audio_format: value })}
        videoOnly={isTvFolder}
        helperText={values.audio_format && !isTvFolder
          ? MP3_HELPER_TEXT + (values.audio_format === 'mp3_only' ? mp3OnlyHint : '')
          : undefined}
        disabled={disabled}
      />
      <div>
        <SubfolderAutocomplete
          mode="channel"
          value={values.sub_folder}
          onChange={(value) => onChange({ sub_folder: value })}
          subfolders={subfolders}
          loading={subfoldersLoading}
          createSubfolder={createSubfolder}
          defaultSubfolderDisplay={defaultSubfolder}
          layoutOf={layoutOf}
          label={subfolderLabel}
          helperText={subfolderHelperText}
          disabled={disabled}
        />
        {showTvShowCaption && isTvFolder && (
          <Typography variant="caption" color="text.secondary" className="block mt-1">
            {TV_SHOW_CAPTION}
          </Typography>
        )}
      </div>
    </div>
  );
};

export default SubscriptionSettingsFields;
