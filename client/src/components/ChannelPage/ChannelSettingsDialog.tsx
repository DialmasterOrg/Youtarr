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
  Collapse,
  Switch,
  FormControlLabel,
  useMediaQuery,
  useTheme,
  ListItemButton,
  Tab,
  Tabs,
} from '@mui/material';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import DownloadIcon from '@mui/icons-material/Download';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RatingIcon from '@mui/icons-material/Star';
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
  auto_download_enabled_tabs: string | null;
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeSection, setActiveSection] = useState('general');

  const [settings, setSettings] = useState<ChannelSettings>({
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
    default_rating: null,
    auto_download_enabled_tabs: null
  });
  const [originalSettings, setOriginalSettings] = useState<ChannelSettings>({
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
    default_rating: null,
    auto_download_enabled_tabs: null
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

  const sections = [
    { id: 'general', label: 'General', icon: <SettingsIcon /> },
    { id: 'auto-download', label: 'Auto Download', icon: <DownloadIcon /> },
    { id: 'filters', label: 'Filters', icon: <FilterAltIcon /> },
    { id: 'ratings', label: 'Ratings', icon: <RatingIcon /> }
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
          default_rating: settingsData.default_rating ?? null,
          auto_download_enabled_tabs: settingsData.auto_download_enabled_tabs ?? 'video'
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
          default_rating: settings.default_rating || null,
          auto_download_enabled_tabs: settings.auto_download_enabled_tabs
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
        default_rating: result?.settings?.default_rating ?? settings.default_rating ?? null,
        auto_download_enabled_tabs: result?.settings?.auto_download_enabled_tabs ?? settings.auto_download_enabled_tabs ?? null
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
           settings.default_rating !== originalSettings.default_rating ||
           settings.auto_download_enabled_tabs !== originalSettings.auto_download_enabled_tabs;
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

  const toggleAutoDownloadTab = (tab: string, enabled: boolean) => {
    const currentTabs = settings.auto_download_enabled_tabs ? settings.auto_download_enabled_tabs.split(',').map(t => t.trim()) : [];
    let newTabs;
    if (enabled) {
      if (!currentTabs.includes(tab)) {
        newTabs = [...currentTabs, tab].join(',');
      } else {
        newTabs = currentTabs.join(',');
      }
    } else {
      newTabs = currentTabs.filter(t => t !== tab).join(',');
    }
    setSettings({
      ...settings,
      auto_download_enabled_tabs: newTabs || ''
    });
  };

  const isTabEnabled = (tab: string) => {
    const currentTabs = settings.auto_download_enabled_tabs ? settings.auto_download_enabled_tabs.split(',').map(t => t.trim()) : [];
    return currentTabs.includes(tab);
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Resolution Override
              </Typography>
              <FormControl fullWidth size="small">
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
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Effective channel quality: {effectiveQualityDisplay}.
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Subfolder
              </Typography>
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
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="caption">
                  Subfolders are automatically prefixed with <code>__</code> on the filesystem.
                </Typography>
              </Alert>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Note: Changing the subfolder will move the channel&apos;s existing folder and files!
              </Typography>
            </Box>
          </Box>
        );
      case 'auto-download':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Automatic Download
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Enable these to automatically download new content from this channel during scheduled tasks.
              </Typography>
            </Alert>
            <FormControlLabel
              control={
                <Switch
                  checked={isTabEnabled('video')}
                  onChange={(e) => toggleAutoDownloadTab('video', e.target.checked)}
                />
              }
              label="Automatically download new Videos"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isTabEnabled('short')}
                  onChange={(e) => toggleAutoDownloadTab('short', e.target.checked)}
                />
              }
              label="Automatically download new Shorts"
            />
          </Box>
        );
      case 'filters':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Duration Filters
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <TextField
                  label="Min Duration (mins)"
                  type="number"
                  value={minDurationMinutes}
                  onChange={(e) => handleDurationChange('min', e.target.value)}
                  placeholder="No minimum"
                  fullWidth
                  size="small"
                  InputProps={{ inputProps: { min: 0 } }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Max Duration (mins)"
                  type="number"
                  value={maxDurationMinutes}
                  onChange={(e) => handleDurationChange('max', e.target.value)}
                  placeholder="No maximum"
                  fullWidth
                  size="small"
                  InputProps={{ inputProps: { min: 0 } }}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Title Regex Filter
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1 }}>
                <TextField
                  label="Title Regex Pattern"
                  value={settings.title_filter_regex || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    title_filter_regex: e.target.value || null
                  })}
                  placeholder="e.g., (?i)podcast|interview"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
                <IconButton
                  size="small"
                  component={Link}
                  href="https://docs.python.org/3/library/re.html#regular-expression-syntax"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ mt: 0.5 }}
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Box>

              <Box sx={{ mt: 1 }}>
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
                    fontSize: '0.75rem',
                    '&:hover': { color: 'primary.dark' }
                  }}
                >
                  {showRegexExamples ? 'Hide examples' : 'Show examples'}
                </Typography>
              </Box>

              <Collapse in={showRegexExamples}>
                <Box sx={{
                  mt: 1,
                  p: 1.5,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider'
                }}>
                  {regexExamples.map((example, index) => (
                    <Box key={index} sx={{ mb: index < regexExamples.length - 1 ? 1.5 : 0 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }} gutterBottom>
                        {example.label}
                      </Typography>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: 'background.paper',
                        p: 0.5,
                        px: 1,
                        borderRadius: 1,
                        mb: 0.5
                      }}>
                        <Typography
                          variant="caption"
                          sx={{ fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}
                        >
                          {example.pattern}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyRegex(example.pattern)}
                        >
                          <ContentCopyIcon sx={{ fontSize: '0.75rem' }} />
                        </IconButton>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {example.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>

            <Box sx={{ mt: 1 }}>
              <Button
                variant="outlined"
                onClick={handlePreviewFilter}
                disabled={loadingPreview || !settings.title_filter_regex}
                size="small"
              >
                {loadingPreview ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Preview Filter
              </Button>
              {previewResult && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  {previewResult.matchCount} of {previewResult.totalCount} matches
                </Typography>
              )}
            </Box>

            {previewError && (
              <Alert severity="error" onClose={() => setPreviewError(null)} size="small">
                {previewError}
              </Alert>
            )}

            {previewResult && (
              <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <List dense>
                  {previewResult.videos.map((video) => (
                    <ListItem key={video.video_id}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {video.matches ? (
                          <CheckCircleIcon color="success" sx={{ fontSize: '1rem' }} />
                        ) : (
                          <CancelIcon color="error" sx={{ fontSize: '1rem' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={video.title}
                        primaryTypographyProps={{
                          sx: {
                            fontSize: '0.75rem',
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
        );
      case 'ratings': {
        const effectiveRatingLabel = settings.default_rating
          ? (RATING_OPTIONS.find((option) => option.value === settings.default_rating)?.label || settings.default_rating)
          : 'Global';
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Content Ratings
            </Typography>
            <Alert severity="info">
              <Typography variant="body2">
                Set a default rating for videos from this channel when no rating metadata is available.
              </Typography>
            </Alert>
            <FormControl fullWidth size="small">
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                Effective default rating:
              </Typography>
              <Chip
                size="small"
                label={effectiveRatingLabel}
                color={settings.default_rating ? 'warning' : 'default'}
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { 
          minHeight: isMobile ? '80vh' : '500px',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        Channel Settings: {channelName}
      </DialogTitle>
      
      {isMobile ? (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs
            value={activeSection}
            onChange={(_, newValue) => setActiveSection(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {sections.map(section => (
              <Tab 
                key={section.id} 
                value={section.id} 
                label={section.label} 
                icon={section.icon}
                iconPosition="start"
                sx={{ minHeight: 48, textTransform: 'none' }}
              />
            ))}
          </Tabs>
        </Box>
      ) : null}

      <DialogContent sx={{ p: 0, display: 'flex' }}>
        {!isMobile && (
          <Box sx={{ 
            width: 200, 
            borderRight: '1px solid', 
            borderColor: 'divider',
            bgcolor: 'action.hover',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <List sx={{ pt: 1 }}>
              {sections.map((section) => (
                <ListItemButton
                  key={section.id}
                  selected={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                  sx={{
                    py: 1.5,
                    borderLeft: activeSection === section.id ? '4px solid' : '4px solid transparent',
                    borderColor: 'primary.main',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: activeSection === section.id ? 'primary.main' : 'inherit' }}>
                    {section.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={section.label} 
                    primaryTypographyProps={{ 
                      variant: 'body2',
                      fontWeight: activeSection === section.id ? 600 : 400,
                      color: activeSection === section.id ? 'primary.main' : 'text.primary'
                    }} 
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        )}

        <Box sx={{ flex: 1, p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={10}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Settings saved successfully!
                </Alert>
              )}

              {renderSectionContent()}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={handleCancel} disabled={saving} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || loading || !hasChanges()}
          sx={{ minWidth: 100 }}
        >
          {saving ? <CircularProgress size={24} /> : 'Save Settings'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ChannelSettingsDialog;
