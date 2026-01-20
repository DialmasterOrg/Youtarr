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
  Link,
  Collapse
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useConfig } from '../../hooks/useConfig';
import { SubfolderAutocomplete } from '../shared/SubfolderAutocomplete';
import { RATING_OPTIONS } from '../../utils/ratings';

interface ChannelSettings {
  sub_folder: string | null;
  video_quality: string | null;
  min_duration: number | null;
  max_duration: number | null;
  title_filter_regex: string | null;
  default_rating: string | null;
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

const regexExamples = [
  {
    label: 'Exclude videos containing a word (case-insensitive)',
    pattern: '(?i)^(?!.*roblox).*',
    description: 'Excludes videos with "roblox" in the title'
  },
  {
    label: 'Exclude videos containing multiple words',
    pattern: '(?i)^(?!.*(roblox|minecraft)).*',
    description: 'Excludes videos with "roblox" OR "minecraft"'
  },
  {
    label: 'Include only videos matching specific phrases',
    pattern: '(?i)(Official Trailer|New Trailer)',
    description: 'Only matches videos containing these phrases'
  }
];

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
    title_filter_regex: null,
    default_rating: null
  });
  const [originalSettings, setOriginalSettings] = useState<ChannelSettings>({
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
    default_rating: null
  });
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Use config hook to get global quality setting
  const { config, refetch: refetchConfig } = useConfig(token);
  const globalQuality = config.preferredResolution || '1080';

  // Duration input state (in minutes for UI convenience)
  const [minDurationMinutes, setMinDurationMinutes] = useState<string>('');
  const [maxDurationMinutes, setMaxDurationMinutes] = useState<string>('');

  // Preview state
  const [previewResult, setPreviewResult] = useState<FilterPreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Regex examples collapsible state
  const [showRegexExamples, setShowRegexExamples] = useState(false);

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
    if (open) {
      // Ensure we have the latest saved global defaults whenever dialog opens
      refetchConfig().catch((err) => console.error('Failed to refresh config for channel settings dialog:', err));
    }
  }, [open, refetchConfig]);

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
          sub_folder: settingsData.sub_folder ?? null,
          video_quality: settingsData.video_quality ?? null,
          min_duration: settingsData.min_duration ?? null,
          max_duration: settingsData.max_duration ?? null,
          title_filter_regex: settingsData.title_filter_regex ?? null,
          default_rating: settingsData.default_rating ?? null
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
          title_filter_regex: settings.title_filter_regex || null,
          default_rating: settings.default_rating || null
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
        title_filter_regex: result?.settings?.title_filter_regex ?? settings.title_filter_regex ?? null,
        default_rating: result?.settings?.default_rating ?? settings.default_rating ?? null
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
           settings.title_filter_regex !== originalSettings.title_filter_regex ||
           settings.default_rating !== originalSettings.default_rating;
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

  const handleCopyRegex = async (pattern: string) => {
    try {
      await navigator.clipboard.writeText(pattern);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
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
                Choose &quot;Default Subfolder&quot; to use your global default setting, or &quot;No Subfolder&quot; to explicitly place in the root directory.
              </Typography>
            </Alert>

            <SubfolderAutocomplete
              mode="channel"
              value={settings.sub_folder}
              onChange={(newValue) => {
                setSettings({
                  ...settings,
                  sub_folder: newValue
                });
              }}
              subfolders={subfolders}
              defaultSubfolderDisplay={config.defaultSubfolder || null}
              label="Subfolder"
              helperText="Choose where this channel's videos are saved"
            />

            <Typography variant="caption" color="text.secondary">
              Note: Changing the subfolder will move the channel&apos;s existing folder and files!</Typography>

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
                label="Min Duration (mins)"
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
                label="Max Duration (mins)"
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

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" sx={{ mb: 1 }}>
              Content Ratings
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Set a default rating for this channel when a video has no rating metadata.
              </Typography>
            </Alert>

            <FormControl fullWidth>
              <InputLabel>Default Rating</InputLabel>
              <Select
                value={settings.default_rating || ''}
                label="Default Rating"
                onChange={(event) => setSettings({
                  ...settings,
                  default_rating: event.target.value || null
                })}
              >
                <MenuItem value="">No Override</MenuItem>
                {RATING_OPTIONS.filter(option => option.value !== '').map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Regex examples toggle and collapsible section */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="body2"
                component="button"
                onClick={() => setShowRegexExamples(!showRegexExamples)}
                sx={{
                  color: 'primary.main',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textDecoration: 'underline',
                  '&:hover': { color: 'primary.dark' }
                }}
              >
                {showRegexExamples ? 'Hide examples' : 'Show examples'}
              </Typography>
            </Box>

            <Collapse in={showRegexExamples}>
              <Box sx={{
                mt: 1,
                p: 2,
                bgcolor: 'action.hover',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                {regexExamples.map((example, index) => (
                  <Box key={index} sx={{ mb: index < regexExamples.length - 1 ? 2 : 0 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {example.label}
                    </Typography>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      bgcolor: 'background.paper',
                      p: 1,
                      borderRadius: 1
                    }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          flex: 1,
                          wordBreak: 'break-all'
                        }}
                      >
                        {example.pattern}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleCopyRegex(example.pattern)}
                        title="Copy to clipboard"
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {example.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Collapse>

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
