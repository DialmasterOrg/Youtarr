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
import InfoIcon from '@mui/icons-material/Info';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useConfig } from '../../hooks/useConfig';
import { SubfolderAutocomplete } from '../shared/SubfolderAutocomplete';

interface PlaylistSettings {
  sub_folder: string | null;
  video_quality: string | null;
  min_duration: number | null;
  max_duration: number | null;
  title_filter_regex: string | null;
  audio_format: string | null;
}

interface PlaylistSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  playlistId: string;
  playlistName: string;
  token: string | null;
  onSettingsSaved?: (settings: PlaylistSettings) => void;
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

function PlaylistSettingsDialog({
  open,
  onClose,
  playlistId,
  playlistName,
  token,
  onSettingsSaved
}: PlaylistSettingsDialogProps) {
  const [settings, setSettings] = useState<PlaylistSettings>({
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
    audio_format: null
  });
  const [originalSettings, setOriginalSettings] = useState<PlaylistSettings>({
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
    audio_format: null
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

  // Regex examples collapsible state
  const [showRegexExamples, setShowRegexExamples] = useState(false);

  const effectiveQualityDisplay = settings.video_quality
    ? `${settings.video_quality}p (playlist)`
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
      refetchConfig().catch((err) => console.error('Failed to refresh config:', err));
    }
  }, [open, refetchConfig]);

  useEffect(() => {
    if (!open) {
      setSuccess(false);
      setError(null);
      return;
    }

    const loadAllData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load playlist settings
        const settingsResponse = await fetch(`/api/playlists/${playlistId}`, {
          headers: {
            'x-access-token': token || ''
          }
        });

        if (!settingsResponse.ok) {
          throw new Error('Failed to load playlist settings');
        }

        const settingsData = await settingsResponse.json();
        const loadedSettings = {
          sub_folder: settingsData.sub_folder || null,
          video_quality: settingsData.video_quality || null,
          min_duration: settingsData.min_duration || null,
          max_duration: settingsData.max_duration || null,
          title_filter_regex: settingsData.title_filter_regex || null,
          audio_format: settingsData.audio_format || null
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
  }, [open, playlistId, token]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/playlists/${playlistId}/settings`, {
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
          audio_format: settings.audio_format || null
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update settings';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch (parseError) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const updatedSettings = {
        sub_folder: result?.playlist?.sub_folder ?? settings.sub_folder ?? null,
        video_quality: result?.playlist?.video_quality ?? settings.video_quality ?? null,
        min_duration: result?.playlist?.min_duration ?? settings.min_duration ?? null,
        max_duration: result?.playlist?.max_duration ?? settings.max_duration ?? null,
        title_filter_regex: result?.playlist?.title_filter_regex ?? settings.title_filter_regex ?? null,
        audio_format: result?.playlist?.audio_format ?? settings.audio_format ?? null
      };

      setSettings(updatedSettings);
      setOriginalSettings(updatedSettings);
      setSuccess(true);

      if (onSettingsSaved) {
        onSettingsSaved(updatedSettings);
      }

      setTimeout(() => {
        onClose();
      }, 1500);
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
           settings.audio_format !== originalSettings.audio_format;
  };

  const handleDurationChange = (type: 'min' | 'max', value: string) => {
    if (type === 'min') {
      setMinDurationMinutes(value);
      const seconds = value ? parseInt(value) * 60 : null;
      setSettings({ ...settings, min_duration: seconds });
    } else {
      setMaxDurationMinutes(value);
      const seconds = value ? parseInt(value) * 60 : null;
      setSettings({ ...settings, max_duration: seconds });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        Playlist Settings
        <Typography variant="caption" display="block" color="text.secondary">
          {playlistName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
                Settings saved successfully!
              </Alert>
            )}

            {/* Subfolder */}
            <SubfolderAutocomplete
              mode="channel"
              value={settings.sub_folder}
              onChange={(newValue) => setSettings({ ...settings, sub_folder: newValue })}
              subfolders={subfolders}
              defaultSubfolderDisplay={config.defaultSubfolder || null}
              label="Download Subfolder"
              helperText="Optional subfolder for organizing downloads"
            />

            {/* Video Quality */}
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Video Quality</InputLabel>
              <Select
                value={settings.video_quality || ''}
                onChange={(e) => setSettings({ ...settings, video_quality: e.target.value || null })}
                label="Video Quality"
              >
                {qualityOptions.map((option) => (
                  <MenuItem key={option.value || 'null'} value={option.value || ''}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                Effective quality: {effectiveQualityDisplay}
              </Typography>
            </FormControl>

            {/* Download Type */}
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Download Type</InputLabel>
              <Select
                value={settings.audio_format || ''}
                onChange={(e) => setSettings({ ...settings, audio_format: e.target.value || null })}
                label="Download Type"
              >
                <MenuItem value="">Video Only (default)</MenuItem>
                <MenuItem value="video_mp3">Video + MP3</MenuItem>
                <MenuItem value="mp3_only">MP3 Only</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                Choose whether to download video only, video with MP3, or audio-only MP3
              </Typography>
            </FormControl>

            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" gutterBottom>
              Download Filters
            </Typography>

            {/* Duration Filters */}
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <TextField
                label="Min Duration (minutes)"
                type="number"
                value={minDurationMinutes}
                onChange={(e) => handleDurationChange('min', e.target.value)}
                fullWidth
                inputProps={{ min: 0 }}
                helperText="Minimum video length"
              />
              <TextField
                label="Max Duration (minutes)"
                type="number"
                value={maxDurationMinutes}
                onChange={(e) => handleDurationChange('max', e.target.value)}
                fullWidth
                inputProps={{ min: 0 }}
                helperText="Maximum video length"
              />
            </Box>

            {/* Title Filter Regex */}
            <TextField
              label="Title Filter (Regex)"
              value={settings.title_filter_regex || ''}
              onChange={(e) => setSettings({ ...settings, title_filter_regex: e.target.value || null })}
              fullWidth
              sx={{ mt: 2 }}
              helperText="Filter videos by title using regular expressions"
              multiline
              rows={2}
            />

            {/* Regex Examples */}
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                onClick={() => setShowRegexExamples(!showRegexExamples)}
                startIcon={<InfoIcon />}
              >
                {showRegexExamples ? 'Hide' : 'Show'} Regex Examples
              </Button>
              <Collapse in={showRegexExamples}>
                <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1, mt: 1 }}>
                  {regexExamples.map((example, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(example.pattern)}
                          title="Copy to clipboard"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </ListItemIcon>
                      <ListItemText
                        primary={example.label}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace', display: 'block' }}>
                              {example.pattern}
                            </Typography>
                            <Typography component="span" variant="caption" color="text.secondary">
                              {example.description}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  <Link href="https://regex101.com/" target="_blank" rel="noopener">
                    Test your regex patterns at regex101.com
                  </Link>
                </Typography>
              </Collapse>
            </Box>
          </>
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
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PlaylistSettingsDialog;
