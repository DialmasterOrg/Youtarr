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
} from '../../ui';
import {
  Download as DownloadIcon,
  Settings as SettingsIcon,
  FolderOpen as FolderIcon,
  Gauge as QualityIcon,
  Video as VideocamIcon
} from '../../../lib/icons';
import { DownloadSettings } from './types';
import { SubfolderAutocomplete } from '../../shared/SubfolderAutocomplete';
import RatingBadge from '../../shared/RatingBadge';
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
  defaultRating?: string | null;
  token?: string | null; // For fetching subfolders
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
  defaultRating = null,
  token = null
}) => {
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  const [resolution, setResolution] = useState(defaultResolution);
  const [channelVideoCount, setChannelVideoCount] = useState(defaultVideoCount);
  const [allowRedownload, setAllowRedownload] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [subfolderOverride, setSubfolderOverride] = useState<string | null>(null);
  const [audioFormat, setAudioFormat] = useState<string | null>(defaultAudioFormat);
  const [rating, setRating] = useState<string | null>(defaultRating);
  const [skipVideoFolder, setSkipVideoFolder] = useState(false);

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
      setSkipVideoFolder(false);
    }
  }, [open, defaultAudioFormat, defaultRating]);

  const handleUseCustomToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setUseCustomSettings(checked);
    setHasUserInteracted(true);
    if (checked) {
      if (rating === null || rating === undefined) {
        if (defaultRating !== null) {
          setRating(defaultRating);
        }
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
    const options: number[] = [];
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
        allowRedownload: allowRedownload,
        rating: null,
      };

      if (mode === 'channel') {
        settingsToSave.videoCount = channelVideoCount;
      }

      localStorage.setItem(storageKey, JSON.stringify(settingsToSave));
    } catch (e) {
      // localStorage might not be available
      console.error('Failed to save settings to localStorage:', e);
    }

    // Include subfolder override if set (only for manual mode)
    const hasOverride = useCustomSettings || allowRedownload ||
      (mode === 'manual' && subfolderOverride !== null) ||
      (mode === 'manual' && audioFormat !== null) ||
      (mode === 'manual' && skipVideoFolder);

    if (hasOverride) {
      onConfirm({
        resolution: useCustomSettings ? resolution : defaultResolution,
        videoCount: mode === 'channel' ? (useCustomSettings ? channelVideoCount : defaultVideoCount) : 0,
        allowRedownload,
        subfolder: mode === 'manual' ? subfolderOverride : undefined,
        audioFormat: mode === 'manual' ? audioFormat : undefined,
        rating: useCustomSettings ? (rating === null ? 'NR' : (rating ?? undefined)) : undefined,
        skipVideoFolder: mode === 'manual' ? (useCustomSettings ? skipVideoFolder : false) : undefined
      });
    } else {
      onConfirm(null); // Use defaults
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
      maxWidth="lg"
      fullWidth
      BackdropProps={{ 'data-testid': 'dialog-backdrop' } as any}
    >
      <DialogTitle>
        <span className="flex items-center gap-2">
          <SettingsIcon size={20} data-testid="SettingsIcon" />
          Download Settings
        </span>
      </DialogTitle>

      <DialogContent>
        <Box className="pt-2">
          {/* Info Alert */}
          <Alert severity="info" className="mb-4">
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
            <Alert severity="warning" className="mb-4">
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
              className="p-4 mb-4 bg-muted/50 border-border"
              data-testid="settings-summary"
            >
              <Typography variant="subtitle2" className="mb-3 font-semibold">
                Current Settings
              </Typography>

              <Box className="flex items-center gap-2 mb-2">
                <QualityIcon size={16} className="text-muted-foreground" />
                <Typography variant="body2">
                  <strong>Quality:</strong> {defaultQualityLabel}
                </Typography>
              </Box>

              <Box className="flex items-center gap-2 mb-3">
                <FolderIcon size={16} className="text-muted-foreground" />
                <Typography variant="body2">
                  <strong>Destination:</strong> Per channel settings (or global default)
                </Typography>
              </Box>

              <Box className="flex items-center gap-2 mb-3">
                <VideocamIcon size={16} className="text-muted-foreground" />
                <Typography variant="body2">
                  <strong>Download Type:</strong> {defaultAudioFormatLabel}
                  {defaultAudioFormatSource === 'channel' && (
                    <Typography component="span" variant="caption" color="text.secondary" className="ml-1">
                      (channel)
                    </Typography>
                  )}
                </Typography>
              </Box>

              {mode === 'channel' && (
                <Box className="flex items-center gap-2 mb-3">
                  <DownloadIcon size={16} data-testid="DownloadIcon" className="text-muted-foreground" />
                  <Typography variant="body2">
                    <strong>Videos per channel:</strong> {defaultVideoCount}
                  </Typography>
                </Box>
              )}

              <Typography variant="caption" color="text.secondary" className="block mt-2">
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
            className="mb-4"
          />

          {/* Custom Settings - Only shown when toggle is ON */}
          <Collapse in={useCustomSettings} timeout={300}>
            <Box data-testid="custom-settings-section" className="mb-4">
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
                className="mb-4 block"
              />

              {/* Resolution Selection */}
              <Typography variant="subtitle2" color="text.secondary" className="mb-2">
                Maximum Resolution
              </Typography>

              <FormControl fullWidth className="mb-4">
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
                <Alert severity="warning" className="mb-4">
                  <Typography variant="body2">
                    4K videos may take significantly longer to download and use more storage space.
                  </Typography>
                </Alert>
              )}

              {/* Videos Per Channel - Channel mode only */}
              {mode === 'channel' && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" className="mb-2">
                    Videos Per Channel
                  </Typography>

                  <FormControl fullWidth className="mb-4">
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
                  <Typography variant="subtitle2" color="text.secondary" className="mb-2">
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

                  <Typography variant="subtitle2" color="text.secondary" className="mb-2 mt-4">
                    Download Type
                  </Typography>

                  <FormControl fullWidth className="mb-4 audio-control audio-control--download-type">
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
                    <Typography variant="subtitle2" color="text.secondary" className="mb-2 mt-4">
                    Content Rating Override
                  </Typography>

                    <FormControl fullWidth className="mb-4">
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
                      <MenuItem value="G"><RatingBadge rating="G" size="small" style={{ marginRight: 8 }} /> G</MenuItem>
                      <MenuItem value="PG"><RatingBadge rating="PG" size="small" style={{ marginRight: 8 }} /> PG</MenuItem>
                      <MenuItem value="PG-13"><RatingBadge rating="PG-13" size="small" style={{ marginRight: 8 }} /> PG-13</MenuItem>
                      <MenuItem value="R"><RatingBadge rating="R" size="small" style={{ marginRight: 8 }} /> R</MenuItem>
                      <MenuItem value="NC-17"><RatingBadge rating="NC-17" size="small" style={{ marginRight: 8 }} /> NC-17</MenuItem>
                      <MenuItem value="TV-Y"><RatingBadge rating="TV-Y" size="small" style={{ marginRight: 8 }} /> TV-Y</MenuItem>
                      <MenuItem value="TV-Y7"><RatingBadge rating="TV-Y7" size="small" style={{ marginRight: 8 }} /> TV-Y7</MenuItem>
                      <MenuItem value="TV-G"><RatingBadge rating="TV-G" size="small" style={{ marginRight: 8 }} /> TV-G</MenuItem>
                      <MenuItem value="TV-PG"><RatingBadge rating="TV-PG" size="small" style={{ marginRight: 8 }} /> TV-PG</MenuItem>
                      <MenuItem value="TV-14"><RatingBadge rating="TV-14" size="small" style={{ marginRight: 8 }} /> TV-14</MenuItem>
                      <MenuItem value="TV-MA"><RatingBadge rating="TV-MA" size="small" style={{ marginRight: 8 }} /> TV-MA</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={skipVideoFolder}
                        onChange={(e) => {
                          setSkipVideoFolder(e.target.checked);
                          setHasUserInteracted(true);
                        }}
                        color="primary"
                      />
                    }
                    label="Flat file structure (no video subfolders)"
                    className="mb-1"
                  />
                  <Typography variant="caption" color="text.secondary" className="mb-4 block">
                    Save files directly in the channel folder instead of individual video subfolders.
                  </Typography>
                </>
              )}
            </Box>
          </Collapse>

          {/* Note about YouTube quality */}
          <Box className="p-4 bg-muted/50 rounded-[var(--radius-ui)]">
            <Typography variant="caption" color="text.secondary">
              <strong>Note:</strong> YouTube will provide the best available quality up to your selected resolution.
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions className="px-6 pb-4">
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          startIcon={<DownloadIcon data-testid="DownloadIcon" />}
          color="primary"
        >
          Start Download
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DownloadSettingsDialog;
