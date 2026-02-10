import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Collapse,
  Alert,
  Paper,
  SelectChangeEvent
} from '@mui/material';
import {
  Download as DownloadIcon,
  Settings as SettingsIcon,
  FolderOpen as FolderIcon,
  HighQuality as QualityIcon,
  Videocam as VideocamIcon
} from '@mui/icons-material';
import { DownloadSettings } from './types';
import RatingBadge from '../../shared/RatingBadge';
import { SubfolderAutocomplete } from '../../shared/SubfolderAutocomplete';
import { useSubfolders } from '../../../hooks/useSubfolders';

interface DownloadSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (settings: DownloadSettings | null) => void;
  videoCount?: number; // For manual downloads
  missingVideoCount?: number; // Number of videos that were previously downloaded but are now missing
  defaultResolution?: string;
  defaultVideoCount?: number; // For channel downloads
  mode?: 'manual' | 'channel'; // To differentiate between modes
  defaultResolutionSource?: 'channel' | 'global';
  defaultAudioFormat?: string | null; // For channel audio format default
  defaultAudioFormatSource?: 'channel' | 'global';
  token?: string | null; // For fetching subfolders
  defaultRating?: string | null;
}

const RESOLUTION_OPTIONS = [
  { value: '360', label: '360p' },
  { value: '480', label: '480p' },
  { value: '720', label: '720p (HD)' },
  { value: '1080', label: '1080p (Full HD)' },
  { value: '1440', label: '1440p (2K)' },
  { value: '2160', label: '2160p (4K)' }
];

const DownloadSettingsDialog: React.FC<DownloadSettingsDialogProps> = ({
  open,
  onClose,
  onConfirm,
  videoCount,
  missingVideoCount = 0,
  defaultResolution = '1080',
  defaultVideoCount = 3,
  mode = 'manual',
  defaultResolutionSource = 'global',
  defaultAudioFormat = null,
  defaultAudioFormatSource = 'global',
  token = null
  ,
  defaultRating = null
}) => {
  const [rating, setRating] = useState<string | null>(null);
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  const [resolution, setResolution] = useState(defaultResolution);
  const [channelVideoCount, setChannelVideoCount] = useState(defaultVideoCount);
  const [allowRedownload, setAllowRedownload] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [subfolderOverride, setSubfolderOverride] = useState<string | null>(null);
  const [audioFormat, setAudioFormat] = useState<string | null>(defaultAudioFormat);

  // Fetch available subfolders
  const { subfolders, loading: subfoldersLoading } = useSubfolders(token);

  const selectedDefaultOption = RESOLUTION_OPTIONS.find((option) => option.value === defaultResolution);
  const defaultQualityLabel = selectedDefaultOption
    ? selectedDefaultOption.label
    : `${defaultResolution}p`;

  const getAudioFormatLabel = (format: string | null) => {
    if (!format) return 'Per channel settings (or video only)';
    if (format === 'video_mp3') return 'Video + MP3';
    if (format === 'mp3_only') return 'Audio Only (MP3)';
    return 'Video Only';
  };

  const defaultAudioFormatLabel = getAudioFormatLabel(defaultAudioFormat);

  // Auto-detect re-download need
  useEffect(() => {
    if (open && !hasUserInteracted) {
      setResolution(defaultResolution);
      setChannelVideoCount(defaultVideoCount);
      setAudioFormat(defaultAudioFormat);
      // Initialize rating from prop when dialog opens
      setRating(defaultRating ?? null);
      // Auto-check re-download if there are missing videos or previously downloaded videos in manual mode
      if (missingVideoCount > 0) {
        setAllowRedownload(true);
      } else {
        setAllowRedownload(false);
      }
    }
  }, [open, hasUserInteracted, mode, missingVideoCount, defaultResolution, defaultVideoCount, defaultAudioFormat]);

  useEffect(() => {
    if (!open) {
      setHasUserInteracted(false);
      setUseCustomSettings(false);
      setAllowRedownload(false);
      setSubfolderOverride(null);
      setAudioFormat(defaultAudioFormat);
      setRating(defaultRating ?? null);
    }
  }, [open, defaultAudioFormat]);

  const handleUseCustomToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setUseCustomSettings(checked);
    setHasUserInteracted(true);
    // When enabling custom settings, if rating is not set, initialize to channel/defaultRating
    if (checked && (rating === null || rating === undefined)) {
      // defaultRating prop may be undefined in some usages
      // prefer to leave null if no defaultRating available
      if (typeof defaultRating !== 'undefined' && defaultRating !== null) {
        setRating(defaultRating);
      }
    }
  };

  const handleResolutionChange = (event: SelectChangeEvent<string>) => {
    setResolution(event.target.value);
    setHasUserInteracted(true);
  };

  const handleVideoCountChange = (event: SelectChangeEvent<string>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value)) {
      setChannelVideoCount(value);
      setHasUserInteracted(true);
    }
  };

  // Generate options for video count dropdown
  const getVideoCountOptions = () => {
    const options = [];
    // Always include 1-10
    for (let i = 1; i <= 10; i++) {
      options.push(i);
    }
    // If current value is greater than 10, include it as well
    if (channelVideoCount > 10 && !options.includes(channelVideoCount)) {
      options.push(channelVideoCount);
      options.sort((a, b) => a - b);
    }
    return options;
  };

  const handleConfirm = () => {
    // Save settings to localStorage for next time
    try {
      const storageKey = mode === 'channel' ? 'youtarr_channel_settings' : 'youtarr_download_settings';
      const settingsToSave: any = {
        useCustom: useCustomSettings,
        resolution: resolution,
        allowRedownload: allowRedownload
      };

      if (mode === 'channel') {
        settingsToSave.videoCount = channelVideoCount;
      }

      // Save rating preference locally only when custom selected in manual mode
      if (rating !== undefined) {
        settingsToSave.rating = rating;
      }

      localStorage.setItem(storageKey, JSON.stringify(settingsToSave));
    } catch (e) {
      // localStorage might not be available
      console.error('Failed to save settings to localStorage:', e);
    }

    // Include subfolder override if set (only for manual mode)
    const hasOverride = useCustomSettings || allowRedownload ||
      (mode === 'manual' && subfolderOverride !== null) ||
      (mode === 'manual' && audioFormat !== null);

    if (hasOverride) {
      onConfirm({
        resolution: useCustomSettings ? resolution : defaultResolution,
        videoCount: mode === 'channel' ? (useCustomSettings ? channelVideoCount : defaultVideoCount) : 0,
        allowRedownload,
        subfolder: mode === 'manual' ? subfolderOverride : undefined,
        audioFormat: mode === 'manual' ? audioFormat : undefined,
        // Include rating only if custom settings are enabled (user explicitly selected it)
        rating: useCustomSettings ? (rating ?? undefined) : undefined
      });
    } else {
      onConfirm(null); // Use defaults - post-processor will apply channel default rating
    }
  };

  const handleCancel = () => {
    // Reset state
    setHasUserInteracted(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      BackdropProps={{ 'data-testid': 'dialog-backdrop' } as any}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        Download Settings
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {/* Info Alert */}
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {mode === 'channel'
                ? 'Downloading new videos from auto-download enabled channels/tabs. Channel settings and filters will be applied per channel.'
                : videoCount === 1
                ? 'You are about to download 1 video.'
                : `You are about to download ${videoCount} videos.`}
            </Typography>
          </Alert>

          {/* Warning for previously downloaded */}
          {missingVideoCount > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                {mode === 'manual' ? (
                  missingVideoCount === 1
                    ? '1 video was previously downloaded.'
                    : `${missingVideoCount} videos were previously downloaded.`
                ) : (
                  missingVideoCount === 1
                    ? 'Re-downloading 1 previously downloaded video.'
                    : `Re-downloading ${missingVideoCount} previously downloaded videos.`
                )}
              </Typography>
            </Alert>
          )}

          {/* Summary Box - Only shown when custom settings are OFF */}
          <Collapse in={!useCustomSettings} timeout={300}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 2,
                bgcolor: 'action.hover',
                borderColor: 'divider'
              }}
              data-testid="settings-summary"
            >
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Current Settings
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <QualityIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2">
                  <strong>Quality:</strong> {defaultQualityLabel}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <FolderIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2">
                  <strong>Destination:</strong> Per channel settings (or global default)
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <VideocamIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2">
                  <strong>Download Type:</strong> {defaultAudioFormatLabel}
                  {defaultAudioFormatSource === 'channel' && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      (channel)
                    </Typography>
                  )}
                </Typography>
              </Box>

              {/* Content Rating in summary */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <strong>Content Rating:</strong>
                  {defaultRating ? (
                    <RatingBadge rating={defaultRating} size="small" />
                  ) : (
                    <span>Not set</span>
                  )}
                </Typography>
              </Box>

              {mode === 'channel' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <DownloadIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2">
                    <strong>Videos per channel:</strong> {defaultVideoCount}
                  </Typography>
                </Box>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Configured channels will use their subfolder settings.
                Enable custom settings to download MP3 audio.
              </Typography>
            </Paper>
          </Collapse>

          {/* Custom Settings Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={useCustomSettings}
                onChange={handleUseCustomToggle}
                color="primary"
              />
            }
            label="Use custom settings for this download"
            sx={{ mb: 2 }}
          />

          {/* Custom Settings - Only shown when toggle is ON */}
          <Collapse in={useCustomSettings} timeout={300}>
            <Box data-testid="custom-settings-section" sx={{ mb: 2 }}>
              {/* Allow Re-download Toggle */}
              <FormControlLabel
                control={
                  <Switch
                    checked={allowRedownload}
                    onChange={(e) => {
                      setAllowRedownload(e.target.checked);
                      setHasUserInteracted(true);
                    }}
                    color="primary"
                  />
                }
                label="Allow re-downloading previously fetched videos"
                sx={{ mb: 2, display: 'block' }}
              />

              {/* Resolution Selection */}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Maximum Resolution
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="resolution-select-label">Maximum Resolution</InputLabel>
                <Select
                  labelId="resolution-select-label"
                  id="resolution-select"
                  value={resolution}
                  label="Maximum Resolution"
                  onChange={handleResolutionChange}
                >
                  {RESOLUTION_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  YouTube will provide the best available quality up to your selected resolution.
                </FormHelperText>
              </FormControl>

              {resolution === '2160' && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    4K videos may take significantly longer to download and use more storage space.
                  </Typography>
                </Alert>
              )}

              {/* Videos Per Channel - Channel mode only */}
              {mode === 'channel' && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Videos Per Channel
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="video-count-select-label">Number of videos to download per channel</InputLabel>
                    <Select
                      labelId="video-count-select-label"
                      id="video-count-select"
                      value={String(channelVideoCount)}
                      label="Number of videos to download per channel"
                      onChange={handleVideoCountChange}
                    >
                      {getVideoCountOptions().map(count => (
                        <MenuItem key={count} value={count}>
                          {count} {count === 1 ? 'video' : 'videos'}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}

              {/* Subfolder Override - Manual mode only */}
              {mode === 'manual' && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Destination Override
                  </Typography>

                  <SubfolderAutocomplete
                    mode="download"
                    value={subfolderOverride}
                    onChange={(newValue) => {
                      setSubfolderOverride(newValue);
                      setHasUserInteracted(true);
                    }}
                    subfolders={subfolders}
                    loading={subfoldersLoading}
                    label="Override Destination"
                    helperText="Configured channels use their subfolder, unconfigured channels use global default."
                  />

                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 2 }}>
                    Download Type
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="audio-format-select-label" shrink>Download Type</InputLabel>
                    <Select
                      labelId="audio-format-select-label"
                      id="audio-format-select"
                      value={audioFormat || ''}
                      label="Download Type"
                      displayEmpty
                      notched
                      onChange={(e) => {
                        setAudioFormat(e.target.value || null);
                        setHasUserInteracted(true);
                      }}
                    >
                      <MenuItem value=""><em>Video Only (default)</em></MenuItem>
                      <MenuItem value="video_mp3">Video + MP3</MenuItem>
                      <MenuItem value="mp3_only">MP3 Only</MenuItem>
                    </Select>
                    {audioFormat && (
                      <FormHelperText>
                        MP3 files are saved at 192kbps in the same folder as videos.
                      </FormHelperText>
                    )}
                  </FormControl>
                  {/* Rating Override - manual/custom only */}
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 2 }}>
                    Content Rating Override
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="rating-select-label" shrink>Content Rating</InputLabel>
                    <Select
                      labelId="rating-select-label"
                      id="rating-select"
                      value={rating || ''}
                      label="Content Rating"
                      displayEmpty
                      onChange={(e) => {
                        const val = e.target.value as string;
                        setRating(val === '' ? null : val);
                        setHasUserInteracted(true);
                      }}
                    >
                      <MenuItem value="">
                        <em>No Rating</em>
                      </MenuItem>
                      <MenuItem value="G"><RatingBadge rating="G" size="small" sx={{ mr: 1 }} /> G</MenuItem>
                      <MenuItem value="PG"><RatingBadge rating="PG" size="small" sx={{ mr: 1 }} /> PG</MenuItem>
                      <MenuItem value="PG-13"><RatingBadge rating="PG-13" size="small" sx={{ mr: 1 }} /> PG-13</MenuItem>
                      <MenuItem value="R"><RatingBadge rating="R" size="small" sx={{ mr: 1 }} /> R</MenuItem>
                      <MenuItem value="NC-17"><RatingBadge rating="NC-17" size="small" sx={{ mr: 1 }} /> NC-17</MenuItem>
                      <MenuItem value="TV-Y"><RatingBadge rating="TV-Y" size="small" sx={{ mr: 1 }} /> TV-Y</MenuItem>
                      <MenuItem value="TV-Y7"><RatingBadge rating="TV-Y7" size="small" sx={{ mr: 1 }} /> TV-Y7</MenuItem>
                      <MenuItem value="TV-G"><RatingBadge rating="TV-G" size="small" sx={{ mr: 1 }} /> TV-G</MenuItem>
                      <MenuItem value="TV-PG"><RatingBadge rating="TV-PG" size="small" sx={{ mr: 1 }} /> TV-PG</MenuItem>
                      <MenuItem value="TV-14"><RatingBadge rating="TV-14" size="small" sx={{ mr: 1 }} /> TV-14</MenuItem>
                      <MenuItem value="TV-MA"><RatingBadge rating="TV-MA" size="small" sx={{ mr: 1 }} /> TV-MA</MenuItem>
                    </Select>
                  </FormControl>
                </>
              )}
            </Box>
          </Collapse>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          startIcon={<DownloadIcon />}
          color="primary"
        >
          Start Download
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DownloadSettingsDialog;
