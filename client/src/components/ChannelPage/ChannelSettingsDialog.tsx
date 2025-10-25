import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Autocomplete,
  CircularProgress,
  Alert,
  Box,
  Typography
} from '@mui/material';

interface ChannelSettings {
  sub_folder: string | null;
  video_quality: string | null;
}

interface ChannelSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  token: string | null;
  onSettingsSaved?: (settings: ChannelSettings) => void;
}

function ChannelSettingsDialog({
  open,
  onClose,
  channelId,
  channelName,
  token,
  onSettingsSaved
}: ChannelSettingsDialogProps) {
  const [settings, setSettings] = useState<ChannelSettings>({
    sub_folder: null,
    video_quality: null
  });
  const [originalSettings, setOriginalSettings] = useState<ChannelSettings>({
    sub_folder: null,
    video_quality: null
  });
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [globalQuality, setGlobalQuality] = useState('1080');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const effectiveQualityDisplay = settings.video_quality
    ? `${settings.video_quality}p (channel override)`
    : `${globalQuality}p (global default)`;

  const qualityOptions = [
    { value: null, label: `Use Global Setting (${globalQuality}p)` },
    { value: '360', label: '360p' },
    { value: '480', label: '480p' },
    { value: '720', label: '720p (HD)' },
    { value: '1080', label: '1080p (Full HD)' },
    { value: '1440', label: '1440p (2K)' },
    { value: '2160', label: '2160p (4K)' }
  ];

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setSuccess(false);
      setError(null);
      return;
    }

    // Load all data when dialog opens
    const loadAllData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load settings
        const settingsResponse = await fetch(`/api/channels/${channelId}/settings`, {
          headers: {
            'x-access-token': token || ''
          }
        });

        if (!settingsResponse.ok) {
          throw new Error('Failed to load channel settings');
        }

        const settingsData = await settingsResponse.json();
        const loadedSettings = {
          sub_folder: settingsData.sub_folder || null,
          video_quality: settingsData.video_quality || null
        };
        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);

        // Load subfolders (non-critical)
        try {
          const subfoldersResponse = await fetch('/api/channels/subfolders', {
            headers: {
              'x-access-token': token || ''
            }
          });

          if (subfoldersResponse.ok) {
            const subfoldersData = await subfoldersResponse.json();
            setSubfolders(subfoldersData);
          }
        } catch (err) {
          console.error('Failed to load subfolders:', err);
        }

        // Load global quality (non-critical)
        try {
          const configResponse = await fetch('/getconfig', {
            headers: {
              'x-access-token': token || ''
            }
          });

          if (configResponse.ok) {
            const configData = await configResponse.json();
            setGlobalQuality(configData.preferredResolution || '1080');
          }
        } catch (err) {
          console.error('Failed to load global quality:', err);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [open, channelId, token]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/channels/${channelId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token || ''
        },
        body: JSON.stringify({
          sub_folder: settings.sub_folder || null,
          video_quality: settings.video_quality || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409) {
          throw new Error('Cannot change subfolder while downloads are in progress for this channel. Please wait for downloads to complete.');
        }
        throw new Error(data.error || 'Failed to update settings');
      }

      const result = await response.json();
      const updatedSettings = {
        sub_folder: result?.settings?.sub_folder ?? settings.sub_folder ?? null,
        video_quality: result?.settings?.video_quality ?? settings.video_quality ?? null
      };

      setSettings(updatedSettings);
      setOriginalSettings(updatedSettings);
      setSuccess(true);

      if (onSettingsSaved) {
        onSettingsSaved(updatedSettings);
      }

      // Show success message briefly then close
      setTimeout(() => {
        onClose();
      }, 1500);

      // If folder was moved, show additional info
      if (result.folderMoved && result.moveResult) {
        console.log('Channel folder moved:', result.moveResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSettings(originalSettings);
    onClose();
  };

  const hasChanges = () => {
    return settings.sub_folder !== originalSettings.sub_folder ||
           settings.video_quality !== originalSettings.video_quality;
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        Channel Settings: {channelName}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={3}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success">
                Settings saved successfully!
              </Alert>
            )}

            <FormControl fullWidth>
              <InputLabel id="video-quality-label" shrink>Channel Video Quality Override</InputLabel>
              <Select
                labelId="video-quality-label"
                value={settings.video_quality || ''}
                label="Channel Video Quality Override"
                onChange={(e) => setSettings({
                  ...settings,
                  video_quality: e.target.value || null
                })}
                displayEmpty
                notched
              >
                <MenuItem value="">
                  <em>Using Global Setting</em>
                </MenuItem>
                {qualityOptions.map((option) => (
                  <MenuItem key={option.value || 'null'} value={option.value || ''}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary">
              Effective channel quality: {effectiveQualityDisplay}. Manual download overrides will override this setting.
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Subfolder Organization
              </Typography>
              <Typography variant="body2" component="div">
                Subfolders are automatically prefixed with <code>__</code> on the filesystem to prevent conflicts with channel names.
                <br />
                <strong>Example:</strong> Enter "Sports" → creates folder <code>__Sports/</code>
              </Typography>
            </Alert>

            <Autocomplete
              freeSolo
              options={subfolders}
              value={settings.sub_folder ? `__${settings.sub_folder}` : ''}
              onChange={(event, newValue) => {
                // Strip __ prefix before saving to DB (backend stores clean names)
                const cleanValue = newValue ? newValue.trim().replace(/^__/, '') : null;
                setSettings({
                  ...settings,
                  sub_folder: cleanValue
                });
              }}
              onInputChange={(event, newInputValue) => {
                // Strip __ prefix before saving to DB (backend stores clean names)
                const cleanValue = newInputValue ? newInputValue.trim().replace(/^__/, '') : null;
                setSettings({
                  ...settings,
                  sub_folder: cleanValue
                });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Subfolder (optional)"
                  placeholder="SportsChannels"
                  helperText="Enter a subfolder name (e.g., 'Sports'). Leave empty to place in root."
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              )}
            />

            <Typography variant="caption" color="text.secondary">
              Note: Changing the subfolder will move the channel's existing folder to the new location.
              This cannot be done while downloads are in progress.
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || loading || !hasChanges()}
        >
          {saving ? <CircularProgress size={24} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ChannelSettingsDialog;
