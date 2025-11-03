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
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Link
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';

interface ChannelSettings {
  sub_folder: string | null;
  video_quality: string | null;
  min_duration: number | null;
  max_duration: number | null;
  title_filter_regex: string | null;
}

interface FilterPreviewVideo {
  video_id: string;
  title: string;
  upload_date: string;
  matches: boolean;
}

interface FilterPreviewResult {
  videos: FilterPreviewVideo[];
  totalCount: number;
  matchCount: number;
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
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null
  });
  const [originalSettings, setOriginalSettings] = useState<ChannelSettings>({
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null
  });
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [globalQuality, setGlobalQuality] = useState('1080');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Duration input state (in minutes for UI convenience)
  const [minDurationMinutes, setMinDurationMinutes] = useState<string>('');
  const [maxDurationMinutes, setMaxDurationMinutes] = useState<string>('');

  // Preview state
  const [previewResult, setPreviewResult] = useState<FilterPreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const effectiveQualityDisplay = settings.video_quality
    ? `${settings.video_quality}p (channel)`
    : `${globalQuality}p (global)`;

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
          video_quality: settingsData.video_quality || null,
          min_duration: settingsData.min_duration || null,
          max_duration: settingsData.max_duration || null,
          title_filter_regex: settingsData.title_filter_regex || null
        };
        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);

        // Convert seconds to minutes for UI
        if (settingsData.min_duration) {
          setMinDurationMinutes(String(Math.floor(settingsData.min_duration / 60)));
        }
        if (settingsData.max_duration) {
          setMaxDurationMinutes(String(Math.floor(settingsData.max_duration / 60)));
        }

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
          video_quality: settings.video_quality || null,
          min_duration: settings.min_duration,
          max_duration: settings.max_duration,
          title_filter_regex: settings.title_filter_regex || null
        })
      });

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Cannot change subfolder while downloads are in progress for this channel. Please wait for downloads to complete.');
        }

        let errorMessage = 'Failed to update settings';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use generic error with status
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      const updatedSettings = {
        sub_folder: result?.settings?.sub_folder ?? settings.sub_folder ?? null,
        video_quality: result?.settings?.video_quality ?? settings.video_quality ?? null,
        min_duration: result?.settings?.min_duration ?? settings.min_duration ?? null,
        max_duration: result?.settings?.max_duration ?? settings.max_duration ?? null,
        title_filter_regex: result?.settings?.title_filter_regex ?? settings.title_filter_regex ?? null
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
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
           settings.video_quality !== originalSettings.video_quality ||
           settings.min_duration !== originalSettings.min_duration ||
           settings.max_duration !== originalSettings.max_duration ||
           settings.title_filter_regex !== originalSettings.title_filter_regex;
  };

  const handlePreviewFilter = async () => {
    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const regex = settings.title_filter_regex || '';
      const response = await fetch(
        `/api/channels/${channelId}/filter-preview?title_filter_regex=${encodeURIComponent(regex)}`,
        {
          headers: {
            'x-access-token': token || ''
          }
        }
      );

      let data;

      if (!response.ok) {
        try {
          data = await response.json();
        } catch (parseError) {
          // Ignore JSON parse failure; will fall back to default message
        }
        const serverMessage = data?.error;
        throw new Error(serverMessage && typeof serverMessage === 'string'
          ? serverMessage
          : 'Failed to load preview');
      }

      data = await response.json();
      setPreviewResult(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load preview');
      setPreviewResult(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDurationChange = (field: 'min' | 'max', value: string) => {
    // Allow empty or numeric values only
    if (value === '' || /^\d+$/.test(value)) {
      if (field === 'min') {
        setMinDurationMinutes(value);
        setSettings({
          ...settings,
          min_duration: value ? parseInt(value) * 60 : null
        });
      } else {
        setMaxDurationMinutes(value);
        setSettings({
          ...settings,
          max_duration: value ? parseInt(value) * 60 : null
        });
      }
    }
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
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
              Effective channel quality: {effectiveQualityDisplay}.
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Subfolder Organization
              </Typography>
              <Typography variant="body2" component="div">
                Subfolders are automatically prefixed with <code>__</code> on the filesystem.
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
              Note: Changing the subfolder will move the channel's existing folder and files!
            </Typography>

            {/* Download Filters Section */}
            <Divider sx={{ my: 0 }} />

            <Typography variant="h6" sx={{ mb: 1 }}>
              Download Filters
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                These filters only apply to channel downloads. Manually selected videos will always download.
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Minimum Duration (minutes)"
                type="number"
                value={minDurationMinutes}
                onChange={(e) => handleDurationChange('min', e.target.value)}
                placeholder="No minimum"
                helperText="Shorter videos will be skipped"
                fullWidth
                InputProps={{
                  inputProps: { min: 0 }
                }}
                InputLabelProps={{
                  shrink: true
                }}
              />
              <TextField
                label="Maximum Duration (minutes)"
                type="number"
                value={maxDurationMinutes}
                onChange={(e) => handleDurationChange('max', e.target.value)}
                placeholder="No maximum"
                helperText="Longer videos will be skipped"
                fullWidth
                InputProps={{
                  inputProps: { min: 0 }
                }}
                InputLabelProps={{
                  shrink: true
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <TextField
                label="Title Filter (Python Regex)"
                value={settings.title_filter_regex || ''}
                onChange={(e) => setSettings({
                  ...settings,
                  title_filter_regex: e.target.value || null
                })}
                placeholder="e.g., (?i)podcast|interview"
                helperText="Only download videos with titles matching regex pattern. (?i) for case-insensitive."
                fullWidth
                InputLabelProps={{
                  shrink: true
                }}
              />
              <IconButton
                size="small"
                component={Link}
                href="https://docs.python.org/3/library/re.html#regular-expression-syntax"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ mt: 1 }}
                title="Python regex documentation"
              >
                <InfoIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                onClick={handlePreviewFilter}
                disabled={loadingPreview || !settings.title_filter_regex}
                size="small"
              >
                {loadingPreview ? <CircularProgress size={20} /> : 'Preview Regex'}
              </Button>
              {previewResult && (
                <Typography variant="body2" color="text.secondary">
                  {previewResult.matchCount} of {previewResult.totalCount} recent videos match
                </Typography>
              )}
            </Box>

            {previewError && (
              <Alert severity="error" onClose={() => setPreviewError(null)}>
                {previewError}
              </Alert>
            )}

            {previewResult && (
              <Box sx={{ mt: 2, maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <List dense>
                  {previewResult.videos.map((video) => (
                    <ListItem key={video.video_id}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {video.matches ? (
                          <CheckCircleIcon color="success" fontSize="small" />
                        ) : (
                          <CancelIcon color="error" fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={video.title}
                        primaryTypographyProps={{
                          sx: {
                            opacity: video.matches ? 1 : 0.5,
                            textDecoration: video.matches ? 'none' : 'line-through'
                          }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
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
