import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  TextField,
  CircularProgress,
  Alert,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Link,
  Collapse,
  ListItemButton,
  Tab,
  Tabs,
  Chip,
} from '../ui';
import { CheckCircle as CheckCircleIcon, XCircle as CancelIcon, Info as InfoIcon, Copy as ContentCopyIcon, Settings as SettingsIcon, Download as DownloadIcon, Filter as FilterAltIcon, Shield as RatingIcon } from '../../lib/icons';
import useMediaQuery from '../../hooks/useMediaQuery';
import { useConfig } from '../../hooks/useConfig';
import { SubfolderAutocomplete } from '../shared/SubfolderAutocomplete';
import { RATING_OPTIONS } from '../../utils/ratings';
import RatingBadge from '../shared/RatingBadge';

interface ChannelSettings {
  sub_folder: string | null;
  video_quality: string | null;
  min_duration: number | null;
  max_duration: number | null;
  title_filter_regex: string | null;
  default_rating: string | null;
  auto_download_enabled_tabs: string | null;
  audio_format: string | null;
  skip_video_folder: boolean | null;
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
  token,
  onSettingsSaved
}: ChannelSettingsDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [activeSection, setActiveSection] = useState('general');

  const [settings, setSettings] = useState<ChannelSettings>({
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
    default_rating: null,
    audio_format: null,
    auto_download_enabled_tabs: null,
    skip_video_folder: null
  });
  const [originalSettings, setOriginalSettings] = useState<ChannelSettings>({
    sub_folder: null,
    video_quality: null,
    min_duration: null,
    max_duration: null,
    title_filter_regex: null,
    default_rating: null,
    audio_format: null,
    auto_download_enabled_tabs: null,
    skip_video_folder: null
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
    { value: '360', label: '360p' },
    { value: '480', label: '480p' },
    { value: '720', label: '720p (HD)' },
    { value: '1080', label: '1080p (Full HD)' },
    { value: '1440', label: '1440p (2K)' },
    { value: '2160', label: '2160p (4K)' }
  ];

  const sections = [
    { id: 'general', label: 'General', icon: <SettingsIcon size={18} /> },
    { id: 'filters', label: 'Filters', icon: <FilterAltIcon size={18} /> },
    { id: 'ratings', label: 'Ratings', icon: <RatingIcon size={18} /> }
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

    setActiveSection('general');

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
        const loadedSettings: ChannelSettings = {
          sub_folder: settingsData.sub_folder || null,
          video_quality: settingsData.video_quality || null,
          min_duration: settingsData.min_duration || null,
          max_duration: settingsData.max_duration || null,
          title_filter_regex: settingsData.title_filter_regex || null,
          auto_download_enabled_tabs: settingsData.auto_download_enabled_tabs ?? 'video',
          audio_format: settingsData.audio_format || null,
          default_rating: Object.prototype.hasOwnProperty.call(settingsData, 'default_rating')
            ? settingsData.default_rating
            : null,
          skip_video_folder: Object.prototype.hasOwnProperty.call(settingsData, 'skip_video_folder')
            ? settingsData.skip_video_folder
            : null,
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
          audio_format: settings.audio_format || null,
          auto_download_enabled_tabs: settings.auto_download_enabled_tabs,
          skip_video_folder: settings.skip_video_folder
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
        audio_format: result?.settings?.audio_format ?? settings.audio_format ?? null,
        default_rating: result?.settings && Object.prototype.hasOwnProperty.call(result.settings, 'default_rating')
          ? result.settings.default_rating
          : settings.default_rating ?? null,
        auto_download_enabled_tabs: result?.settings?.auto_download_enabled_tabs ?? settings.auto_download_enabled_tabs ?? null,
        skip_video_folder: result?.settings && Object.prototype.hasOwnProperty.call(result.settings, 'skip_video_folder')
          ? result.settings.skip_video_folder
          : settings.skip_video_folder ?? null,
      };

      setSettings(updatedSettings);
      setOriginalSettings(updatedSettings);
      setSuccess(true);

      if (onSettingsSaved) {
        onSettingsSaved({
          sub_folder: updatedSettings.sub_folder,
          video_quality: updatedSettings.video_quality,
          min_duration: updatedSettings.min_duration,
          max_duration: updatedSettings.max_duration,
          title_filter_regex: updatedSettings.title_filter_regex,
          audio_format: updatedSettings.audio_format,
          default_rating: updatedSettings.default_rating,
        } as ChannelSettings);
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
           settings.audio_format !== originalSettings.audio_format ||
           settings.default_rating !== originalSettings.default_rating ||
          settings.auto_download_enabled_tabs !== originalSettings.auto_download_enabled_tabs ||
          settings.skip_video_folder !== originalSettings.skip_video_folder;
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

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'general':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24 }}>
            <div>
              <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
                Auto Downloads
              </Typography>
              <Alert severity="info" style={{ marginBottom: 12 }}>
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
            </div>

            <Divider />

            <div>
              <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
                Resolution Override
              </Typography>
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
              <Typography variant="caption" color="text.secondary" style={{ marginTop: 8, display: 'block' }}>
                Effective channel quality: {effectiveQualityDisplay}.
              </Typography>
            </div>

            <FormControl fullWidth style={{ marginTop: 8 }}>
              <InputLabel id="audio-format-label" shrink>Download Type</InputLabel>
              <Select
                labelId="audio-format-label"
                value={settings.audio_format || ''}
                label="Download Type"
                onChange={(e) => setSettings({
                  ...settings,
                  audio_format: e.target.value || null
                })}
                displayEmpty
                notched
              >
                <MenuItem value="">
                  <em>Video Only (default)</em>
                </MenuItem>
                <MenuItem value="video_mp3">Video + MP3</MenuItem>
                <MenuItem value="mp3_only">MP3 Only</MenuItem>
              </Select>
            </FormControl>

            {settings.audio_format && (
              <Typography variant="caption" color="text.secondary" style={{ marginTop: 8, display: 'block' }}>
                MP3 files are saved at 192kbps in the same folder as videos.
              </Typography>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={!!settings.skip_video_folder}
                  onChange={(e) => setSettings({
                    ...settings,
                    skip_video_folder: e.target.checked ? true : null
                  })}
                  color="primary"
                />
              }
              label="Flat file structure (no video subfolders)"
              style={{ marginTop: 8 }}
            />
            <Typography variant="caption" color="text.secondary" style={{ marginTop: -4, marginBottom: 8, display: 'block' }}>
              When enabled, video files are saved directly in the channel folder instead of individual video subfolders. Only affects new downloads.
            </Typography>

            <Alert severity="info" style={{ marginBottom: 16 }}>
              <Typography variant="body2" style={{ fontWeight: 'bold', marginBottom: 8 }}>
                Subfolder Organization
              </Typography>
              <Typography variant="body2">
                Use subfolders to keep channel downloads organized without changing your global storage path.
              </Typography>
            </Alert>

            <Divider />

            <div>
              <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
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
              <Alert severity="info" style={{ marginTop: 8 }}>
                <Typography variant="caption">
                  Subfolders are automatically prefixed with <code>__</code> on the filesystem.
                </Typography>
              </Alert>
              <Typography variant="caption" color="text.secondary" style={{ marginTop: 8, display: 'block' }}>
                Note: Changing the subfolder will move the channel&apos;s existing folder and files!
              </Typography>
            </div>
          </div>
        );
      case 'filters':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24 }}>
            <div>
              <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
                Duration Filters
              </Typography>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                <TextField
                  label="Min Duration (mins)"
                  type="number"
                  value={minDurationMinutes}
                  onChange={(e) => handleDurationChange('min', e.target.value)}
                  placeholder="No minimum"
                  fullWidth
                  size="small"
                  inputProps={{ min: 0 }}
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
                  inputProps={{ min: 0 }}
                  InputLabelProps={{ shrink: true }}
                />
              </div>
            </div>

            <Divider />

            <div>
              <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
                Download Filters
              </Typography>
              <Typography variant="caption" color="text.secondary" style={{ display: 'block', marginBottom: 8 }}>
                Only download videos with titles matching regex pattern
              </Typography>
              <Typography variant="caption" color="text.secondary" style={{ display: 'block', marginBottom: 8 }}>
                These filters only apply to channel downloads. Manually selected videos will always download.
              </Typography>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
                <TextField
                  label="Title Filter (Python Regex)"
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
                <a
                  href="https://docs.python.org/3/library/re.html#regular-expression-syntax"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Python regex documentation"
                  style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', color: 'var(--muted-foreground)' }}
                >
                  <InfoIcon size={16} />
                </a>
              </div>

              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowRegexExamples(!showRegexExamples)}
                  style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, textDecoration: 'underline', fontSize: '0.75rem' }}
                >
                  {showRegexExamples ? 'Hide examples' : 'Show examples'}
                </button>
              </div>

              <Collapse in={showRegexExamples}>
                <div style={{ marginTop: 8, padding: 12, backgroundColor: 'var(--muted)', borderRadius: 4, border: '1px solid var(--border)' }}>
                  {regexExamples.map((example, index) => (
                    <div key={index} style={{ marginBottom: index < regexExamples.length - 1 ? 12 : 0 }}>
                      <Typography variant="caption" style={{ fontWeight: 600 }} gutterBottom>
                        {example.label}
                      </Typography>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--card)', padding: '4px 8px', borderRadius: 4, marginBottom: 4 }}>
                        <Typography
                          variant="caption"
                          style={{ fontFamily: 'var(--font-body)', flex: 1, wordBreak: 'break-all' }}
                        >
                          {example.pattern}
                        </Typography>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 2, color: 'var(--muted-foreground)' }}
                          onClick={() => handleCopyRegex(example.pattern)}
                        >
                          <ContentCopyIcon size={12} />
                        </button>
                      </div>
                      <Typography variant="caption" color="text.secondary" style={{ fontSize: '0.7rem' }}>
                        {example.description}
                      </Typography>
                    </div>
                  ))}
                </div>
              </Collapse>
            </div>

            <div style={{ marginTop: 8 }}>
              <Button
                variant="outlined"
                onClick={handlePreviewFilter}
                disabled={loadingPreview || !settings.title_filter_regex}
                size="small"
              >
                {loadingPreview ? <CircularProgress size={16} style={{ marginRight: 8 }} /> : null}
                Preview Regex
              </Button>
              {previewResult && (
                <Typography variant="caption" color="text.secondary" style={{ marginLeft: 16 }}>
                  {previewResult.matchCount} of {previewResult.totalCount} recent videos match
                </Typography>
              )}
            </div>

            {previewError && (
              <Alert severity="error" onClose={() => setPreviewError(null)}>
                {previewError}
              </Alert>
            )}

            {previewResult && (
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                <List dense>
                  {previewResult.videos.map((video) => (
                    <ListItem key={video.video_id}>
                      <ListItemIcon style={{ minWidth: 32 }}>
                        {video.matches ? (
                          <CheckCircleIcon size={16} style={{ color: 'var(--success)' }} />
                        ) : (
                          <CancelIcon size={16} style={{ color: 'var(--destructive)' }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={video.title}
                        primaryTypographyProps={{
                          style: {
                            fontSize: '0.75rem',
                            opacity: video.matches ? 1 : 0.5,
                            textDecoration: video.matches ? 'none' : 'line-through'
                          }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </div>
            )}
          </div>
        );
      case 'ratings': {
        const effectiveRatingLabel = settings.default_rating
          ? (RATING_OPTIONS.find((option) => option.value === settings.default_rating)?.label || settings.default_rating)
          : 'Global';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
              Content Ratings
            </Typography>
            <Alert severity="info">
              <Typography variant="body2">
                Set a default rating for videos from this channel when no rating metadata is available.
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                Effective default rating:
              </Typography>
              <RatingBadge 
                rating={effectiveRatingLabel} 
                size="small" 
              />
            </div>
          </div>
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
      maxWidth="xl" 
      fullWidth
      className={isMobile ? 'w-[calc(100vw-24px)] max-w-none max-h-[calc(100dvh-24px)]' : 'max-h-[calc(100vh-120px)]'}
    >
      <DialogTitle style={{ paddingBottom: 8 }}>
        Channel Settings
      </DialogTitle>
      
      {isMobile ? (
        <div style={{ borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
          <Tabs
            value={activeSection}
            onChange={(_, newValue) => setActiveSection(String(newValue))}
            variant="fullWidth"
          >
            {sections.map(section => (
              <Tab 
                key={section.id} 
                value={section.id} 
                label={section.label} 
                icon={section.icon}
                iconPosition="start"
                style={{ minHeight: 40, textTransform: 'none', fontSize: '0.72rem', paddingLeft: 8, paddingRight: 8 }}
              />
            ))}
          </Tabs>
        </div>
      ) : null}

      <DialogContent style={{ padding: 0, display: 'flex', minHeight: 0 }}>
        {!isMobile && (
          <div style={{ 
            width: 200, 
            borderRight: '1px solid var(--border)',
            backgroundColor: 'var(--muted)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <List style={{ paddingTop: 8 }}>
              {sections.map((section) => (
                <ListItemButton
                  key={section.id}
                  selected={activeSection === section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderLeft: activeSection === section.id ? '4px solid var(--primary)' : '4px solid transparent',
                  }}
                >
                  <ListItemIcon style={{ minWidth: 40, color: activeSection === section.id ? 'var(--primary)' : 'inherit' }}>
                    {section.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={section.label} 
                    primaryTypographyProps={{ 
                      variant: 'body2',
                      style: {
                        fontWeight: activeSection === section.id ? 600 : 400,
                        color: activeSection === section.id ? 'var(--primary)' : 'inherit'
                      }
                    }} 
                  />
                </ListItemButton>
              ))}
            </List>
          </div>
        )}

        <div style={{ flex: 1, padding: isMobile ? 12 : 24, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 80, paddingBottom: 80 }}>
              <CircularProgress />
            </div>
          ) : (
            <>
              {error && (
                <Alert severity="error" style={{ marginBottom: 16 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" style={{ marginBottom: 16 }}>
                  Settings saved successfully!
                </Alert>
              )}

              {isMobile ? (
                renderSectionContent(activeSection)
              ) : (
                renderSectionContent(activeSection)
              )}
            </>
          )}
        </div>
      </DialogContent>
      <DialogActions style={{ padding: isMobile ? '12px' : '16px 24px', borderTop: '1px solid var(--border)' }}>
        <Button onClick={handleCancel} disabled={saving} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || loading || !hasChanges()}
          style={{ minWidth: 100 }}
        >
          {saving ? <CircularProgress size={24} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ChannelSettingsDialog;
