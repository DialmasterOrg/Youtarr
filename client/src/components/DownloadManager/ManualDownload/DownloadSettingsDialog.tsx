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
  Typography,
  Box,
  Switch,
  FormControlLabel,
  Divider,
  Alert
} from '@mui/material';
import {
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { DownloadSettings } from './types';

interface DownloadSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (settings: DownloadSettings | null) => void;
  videoCount?: number; // For manual downloads
  missingVideoCount?: number; // Number of videos that were previously downloaded but are now missing
  defaultResolution?: string;
  defaultVideoCount?: number; // For channel downloads
  mode?: 'manual' | 'channel'; // To differentiate between modes
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
  mode = 'manual'
}) => {
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  const [resolution, setResolution] = useState(defaultResolution);
  const [channelVideoCount, setChannelVideoCount] = useState(defaultVideoCount);
  const [allowRedownload, setAllowRedownload] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Load last used settings from localStorage and auto-detect re-download need
  useEffect(() => {
    if (open && !hasUserInteracted) {
      // Auto-check re-download if there are missing videos or previously downloaded videos in manual mode
      if (missingVideoCount > 0) {
        setAllowRedownload(true);
      }
    }
  }, [open, hasUserInteracted, mode, missingVideoCount]);

  const handleUseCustomToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUseCustomSettings(event.target.checked);
    setHasUserInteracted(true);
  };

  const handleResolutionChange = (event: any) => {
    setResolution(event.target.value);
    setHasUserInteracted(true);
  };

  const handleVideoCountChange = (event: any) => {
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

      localStorage.setItem(storageKey, JSON.stringify(settingsToSave));
    } catch (e) {
      // localStorage might not be available
      console.error('Failed to save settings to localStorage:', e);
    }

    if (useCustomSettings || allowRedownload) {
      onConfirm({
        resolution: useCustomSettings ? resolution : defaultResolution,
        videoCount: mode === 'channel' ? (useCustomSettings ? channelVideoCount : defaultVideoCount) : 0,
        allowRedownload
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
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {mode === 'channel'
                ? 'This will download any new videos from all channels.'
                : videoCount === 1
                ? 'You are about to download 1 video.'
                : `You are about to download ${videoCount} videos.`}
            </Typography>
          </Alert>

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
            sx={{ mb: 2 }}
          />

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

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ opacity: useCustomSettings ? 1 : 0.5, transition: 'opacity 0.3s' }} data-testid="custom-settings-section">
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Custom Video Quality
            </Typography>

            <FormControl fullWidth disabled={!useCustomSettings}>
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
            </FormControl>

            {mode === 'channel' && (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, mt: 2 }}>
                  Videos Per Channel
                </Typography>

                <FormControl fullWidth disabled={!useCustomSettings}>
                  <InputLabel id="video-count-select-label">Number of videos to download per channel</InputLabel>
                  <Select
                    labelId="video-count-select-label"
                    id="video-count-select"
                    value={channelVideoCount}
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
                {!useCustomSettings && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Using default: {defaultVideoCount} videos per channel
                  </Typography>
                )}
              </>
            )}

            {useCustomSettings && resolution === '2160' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  4K videos may take significantly longer to download and use more storage space.
                </Typography>
              </Alert>
            )}
          </Box>

          {!useCustomSettings && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'primary.main', borderRadius: 1, color: 'primary.contrastText' }}>
              <InfoIcon fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Using default settings{mode === 'channel' ? `: ${defaultVideoCount} videos per channel at ` : ': '}{RESOLUTION_OPTIONS.find(r => r.value === defaultResolution)?.label || `${defaultResolution}p`}
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Note:</strong> YouTube will provide the best available quality up to your selected resolution.
            </Typography>
          </Box>
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