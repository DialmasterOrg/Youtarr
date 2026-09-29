import React from 'react';
import { Alert, FormControlLabel, Switch, Typography } from '../../ui';
import { useConfig } from '../../../hooks/useConfig';
import SubscriptionSettingsFields, { SubscriptionSettingsValues } from './SubscriptionSettingsFields';

export interface NewPlaylistSettingsValues extends SubscriptionSettingsValues {
  auto_download: boolean;
}

interface NewPlaylistSettingsProps {
  token: string | null;
  values: NewPlaylistSettingsValues;
  onChange: (patch: Partial<NewPlaylistSettingsValues>) => void;
  /** Shows saved settings of a playlist being restored without letting them change. */
  readOnly?: boolean;
}

const MP3_ONLY_SYNC_HINT =
  ' MP3 Only playlists sync to media servers as music playlists: the server needs a music-type library that includes your Youtarr output folder.';

/** Settings chosen in the Add Playlist dialog before subscribing. */
const NewPlaylistSettings: React.FC<NewPlaylistSettingsProps> = ({ token, values, onChange, readOnly = false }) => {
  const { config, loading: configLoading } = useConfig(token);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FormControlLabel
          control={
            <Switch
              checked={values.auto_download}
              onChange={(e) => onChange({ auto_download: e.target.checked })}
              disabled={readOnly}
            />
          }
          label="Automatically download new videos"
        />
        {values.auto_download && (
          <Typography variant="caption" color="text.secondary" className="block">
            Only videos added to the playlist from now on download automatically. You can pick existing videos to
            download from the playlist page.
          </Typography>
        )}
        {values.auto_download && !configLoading && !config.channelAutoDownload && (
          <Alert severity="warning" className="mt-2">
            <Typography variant="body2">
              Automatic downloads are turned off in Settings -&gt; Core. New videos download once they are turned on.
            </Typography>
          </Alert>
        )}
      </div>

      <SubscriptionSettingsFields
        token={token}
        values={values}
        onChange={onChange}
        globalQuality={config.preferredResolution || '1080'}
        defaultSubfolder={config.defaultSubfolder || null}
        subfolderLabel="Default Subfolder"
        subfolderHelperText="Where this playlist's videos are saved when the channel has no subfolder of its own."
        mp3OnlyHint={MP3_ONLY_SYNC_HINT}
        disabled={readOnly}
      />
    </div>
  );
};

export default NewPlaylistSettings;
