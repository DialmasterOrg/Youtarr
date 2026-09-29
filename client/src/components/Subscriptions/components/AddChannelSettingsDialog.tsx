import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Switch,
  Typography,
} from '../../ui';
import { useConfig } from '../../../hooks/useConfig';
import { NewChannelSettings, PendingChannel, getNewChannelSettings } from '../newChannelSettings';
import SubscriptionSettingsFields from './SubscriptionSettingsFields';

// Channel tab types in display order, with the media type auto-download stores for each.
const AUTO_DOWNLOAD_TABS = [
  { tab: 'videos', mediaType: 'video', label: 'New Videos' },
  { tab: 'shorts', mediaType: 'short', label: 'New Shorts' },
  { tab: 'streams', mediaType: 'livestream', label: 'New Live/Streams' },
];

interface AddChannelSettingsDialogProps {
  open: boolean;
  channel: PendingChannel | null;
  /** 'add' confirms a looked-up channel into the pending list; 'edit' changes a pending one. */
  mode: 'add' | 'edit';
  token: string | null;
  onConfirm: (settings: NewChannelSettings) => void;
  onClose: () => void;
}

const parseCsv = (value: string | null | undefined): string[] =>
  (value || '').split(',').map((entry) => entry.trim()).filter(Boolean);

const AddChannelSettingsDialog: React.FC<AddChannelSettingsDialogProps> = ({
  open,
  channel,
  mode,
  token,
  onConfirm,
  onClose,
}) => {
  const { config, loading: configLoading } = useConfig(token);
  const [settings, setSettings] = useState<NewChannelSettings | null>(null);

  useEffect(() => {
    if (open && channel) {
      setSettings(getNewChannelSettings(channel));
    }
  }, [open, channel]);

  if (!channel || !settings) return null;

  const detectedTabs = parseCsv(channel.available_tabs);
  const tabOptions = AUTO_DOWNLOAD_TABS.filter(({ tab }) => detectedTabs.includes(tab));
  const enabledMediaTypes = parseCsv(settings.auto_download_enabled_tabs);

  const toggleMediaType = (mediaType: string, enabled: boolean) => {
    const next = AUTO_DOWNLOAD_TABS
      .map((option) => option.mediaType)
      .filter((type) => (type === mediaType ? enabled : enabledMediaTypes.includes(type)));
    setSettings({ ...settings, auto_download_enabled_tabs: next.join(',') });
  };

  const thumbnailSrc = channel.channel_id
    ? `/images/channelthumb-${channel.channel_id}.jpg`
    : '/images/channelthumb-default.jpg';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'add' ? 'Add channel' : 'Edit pending channel'}</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center gap-3">
            <Avatar src={thumbnailSrc} alt={`${channel.uploader} thumbnail`} style={{ width: 56, height: 56 }} />
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {channel.uploader}
            </Typography>
          </div>

          {channel.restored && (
            <Alert severity="info">
              <Typography variant="body2">
                Previously subscribed. Its saved settings are filled in below.
              </Typography>
            </Alert>
          )}

          <div>
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
              Auto Downloads
            </Typography>
            {!configLoading && !config.channelAutoDownload && (
              <Alert severity="warning" className="mb-2">
                <Typography variant="body2">
                  Automatic downloads are turned off in Settings -&gt; Core. These choices take effect once they are turned on.
                </Typography>
              </Alert>
            )}
            {tabOptions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Youtarr couldn&apos;t detect this channel&apos;s tabs yet, so new videos will download automatically by
                default. You can change this from the channel page after saving.
              </Typography>
            ) : (
              <div className="flex flex-wrap gap-4">
                {tabOptions.map(({ mediaType, label }) => (
                  <FormControlLabel
                    key={mediaType}
                    control={
                      <Switch
                        checked={enabledMediaTypes.includes(mediaType)}
                        onChange={(e) => toggleMediaType(mediaType, e.target.checked)}
                      />
                    }
                    label={label}
                  />
                ))}
              </div>
            )}
          </div>

          <Divider />

          <SubscriptionSettingsFields
            token={token}
            values={settings}
            onChange={(patch) => setSettings({ ...settings, ...patch })}
            globalQuality={config.preferredResolution || '1080'}
            defaultSubfolder={config.defaultSubfolder || null}
            subfolderLabel="Subfolder"
            subfolderHelperText="Choose where this channel's videos are saved"
          />

          <Typography variant="caption" color="text.secondary">
            Filters, ratings, and auto-removal are available on the channel page after you save.
          </Typography>
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onConfirm(settings)}>
          {mode === 'add' ? 'Continue' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddChannelSettingsDialog;
