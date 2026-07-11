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
import { ResolutionSelect } from '../../shared/ResolutionSelect';
import { OptionSelect } from '../../shared/OptionSelect';
import { RatingSelect } from '../../shared/RatingSelect';
import { useSubfolders } from '../../../hooks/useSubfolders';
import { RESOLUTION_OPTIONS, AUDIO_FORMAT_OPTIONS, SelectOption } from '../../../utils/downloadOptions';

const LARGE_DOWNLOAD_WARNING_THRESHOLD = 50;

type FileStructureChoice = 'inherit' | 'flat' | 'subfolders';

// Four-state, unlike channel/playlist settings where a null audio_format means
// video only. Here the empty option means "no override" (channel/playlist setting
// applies); VIDEO_ONLY_CHOICE sends an explicit audioFormat: null to force video.
const VIDEO_ONLY_CHOICE = 'video_only';
const DOWNLOAD_TYPE_OPTIONS: SelectOption[] = [
  { value: VIDEO_ONLY_CHOICE, label: 'Video Only' },
  ...AUDIO_FORMAT_OPTIONS,
];

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
  defaultAudioFormat?: string | null; // For channel/playlist audio format default
  defaultAudioFormatSource?: 'channel' | 'playlist' | 'global';
  token?: string | null; // For fetching subfolders
  // Hides the "Allow re-downloading" switch and guarantees allowRedownload is
  // never emitted.
  hideRedownloadOption?: boolean;
}

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
  token = null,
  hideRedownloadOption = false
}) => {
  const [useCustomSettings, setUseCustomSettings] = useState(false);
  // Override controls default to "no override" (null) so that simply opening
  // the custom settings section never emits overrides the user didn't choose.
  const [resolution, setResolution] = useState<string | null>(null);
  const [channelVideoCount, setChannelVideoCount] = useState(defaultVideoCount);
  const [allowRedownload, setAllowRedownload] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [subfolderOverride, setSubfolderOverride] = useState<string | null>(null);
  const [audioFormat, setAudioFormat] = useState<string | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  const [fileStructure, setFileStructure] = useState<FileStructureChoice>('inherit');

  // Fetch available subfolders
  const { subfolders, loading: subfoldersLoading, createSubfolder } = useSubfolders(token);

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

  // "No override" outcome for the Download Type select: show the actual
  // channel/playlist setting when the flow knows it (channel page, video
  // modal, playlist page); the paste flow can only state the per-video rule.
  const downloadTypeSettingLabel =
    DOWNLOAD_TYPE_OPTIONS.find((option) => option.value === defaultAudioFormat)?.label
    ?? 'Video Only';
  const downloadTypeEmptyLabel =
    defaultAudioFormatSource === 'channel'
      ? `No override (channel setting: ${downloadTypeSettingLabel})`
      : defaultAudioFormatSource === 'playlist'
        // Channel settings beat the playlist setting per video, so the playlist value is only the fallback.
        ? `No override (per channel, else playlist setting: ${downloadTypeSettingLabel})`
        : 'No override (per channel, else Video Only)';

  const isMp3Format = audioFormat === 'video_mp3' || audioFormat === 'mp3_only';
  const downloadTypeHelperText = isMp3Format
    ? 'MP3 files are saved at 192kbps in the same folder as videos.'
    : audioFormat === null && defaultAudioFormatSource === 'global'
      ? 'Configured channels use their Download Type setting; all other videos download as Video Only.'
      : undefined;

  // Auto-detect re-download need
  useEffect(() => {
    if (open && !hasUserInteracted) {
      setResolution(null);
      setChannelVideoCount(defaultVideoCount);
      setAudioFormat(null);
      // Open the custom section too so the user can see the re-download toggle is on.
      if (missingVideoCount > 0 && !hideRedownloadOption) {
        setAllowRedownload(true);
        setUseCustomSettings(true);
      } else {
        setAllowRedownload(false);
      }
    }
  }, [open, hasUserInteracted, mode, missingVideoCount, defaultVideoCount, hideRedownloadOption]);

  useEffect(() => {
    if (!open) {
      setHasUserInteracted(false);
      setUseCustomSettings(false);
      setAllowRedownload(false);
      setResolution(null);
      setSubfolderOverride(null);
      setAudioFormat(null);
      setRating(null);
      setFileStructure('inherit');
    }
  }, [open]);

  const handleUseCustomToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUseCustomSettings(event.target.checked);
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
    try {
      const storageKey = mode === 'channel' ? 'youtarr_channel_settings' : 'youtarr_download_settings';
      const settingsToSave: Record<string, unknown> = {
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
      console.error('Failed to save settings to localStorage:', e);
    }

    // Emit only fields the user genuinely overrode. Omitted fields fall through
    // to channel -> playlist -> global on the backend.
    const override: DownloadSettings = {};

    if (useCustomSettings) {
      if (resolution !== null) {
        override.resolution = resolution;
      }
      if (mode === 'channel' && channelVideoCount !== defaultVideoCount) {
        override.videoCount = channelVideoCount;
      }
      if (mode === 'manual') {
        if (subfolderOverride !== null) {
          override.subfolder = subfolderOverride;
        }
        if (audioFormat !== null) {
          override.audioFormat = audioFormat === VIDEO_ONLY_CHOICE ? null : audioFormat;
        }
        if (fileStructure !== 'inherit') {
          override.skipVideoFolder = fileStructure === 'flat';
        }
      }
      if (rating !== null) {
        override.rating = rating;
      }
    }

    if (allowRedownload && !hideRedownloadOption) {
      override.allowRedownload = true;
    }

    onConfirm(Object.keys(override).length === 0 ? null : override);
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
                ? 'Downloading new videos from auto-download enabled channels/tabs and playlists. Channel and playlist settings and filters will be applied per channel/playlist.'
                : videoCount === 1
                ? 'You are about to download 1 video.'
                : `You are about to download ${videoCount} videos.`}
            </Typography>
          </Alert>

          {typeof videoCount === 'number' && videoCount > LARGE_DOWNLOAD_WARNING_THRESHOLD && (
            <Alert severity="warning" className="mb-4">
              <Typography variant="body2">
                That is a large batch ({videoCount} videos). It may take a while and use
                significant disk space.
              </Typography>
            </Alert>
          )}

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
                  <strong>Quality:</strong>{' '}
                  {mode === 'channel'
                    ? `Per channel/playlist (global ${defaultResolution}p)`
                    : defaultQualityLabel}
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
              {!hideRedownloadOption && (
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
              )}

              {/* Resolution Selection */}
              <Typography variant="subtitle2" color="text.secondary" className="mb-2">
                Maximum Resolution
              </Typography>

              <ResolutionSelect
                className="mb-4"
                value={resolution}
                emptyLabel="No override (use channel/playlist settings)"
                onChange={(value) => {
                  setResolution(value);
                  setHasUserInteracted(true);
                }}
                helperText="YouTube will provide the best available quality up to your selected resolution."
              />

              {(resolution === '2160' || resolution === '1440') && (
                <Alert severity="warning" className="mb-4">
                  <Typography variant="body2">
                    {resolution === '2160'
                      ? '4K videos may take significantly longer to download and use more storage space. '
                      : ''}
                    YouTube only provides H.264 MP4 up to 1080p, so {resolution === '2160' ? '4K' : '1440p'} uses VP9 or AV1 (remuxed into MP4). Older Plex clients without native VP9/AV1 decode (Apple TV HD, iOS, older Rokus) may transcode.
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
                    createSubfolder={createSubfolder}
                    label="Override Destination"
                    helperText="Configured channels use their subfolder, unconfigured channels use global default."
                  />

                  <Typography variant="subtitle2" color="text.secondary" className="mb-2 mt-4">
                    Download Type
                  </Typography>

                  <OptionSelect
                    className="mb-4 audio-control audio-control--download-type"
                    options={DOWNLOAD_TYPE_OPTIONS}
                    label="Download Type"
                    emptyLabel={downloadTypeEmptyLabel}
                    value={audioFormat}
                    onChange={(value) => {
                      setAudioFormat(value);
                      setHasUserInteracted(true);
                    }}
                    helperText={downloadTypeHelperText}
                  />
                    <Typography variant="subtitle2" color="text.secondary" className="mb-2 mt-4">
                    Content Rating Override
                  </Typography>

                  <RatingSelect
                    className="mb-4"
                    value={rating}
                    onChange={(value) => {
                      setRating(value);
                      setHasUserInteracted(true);
                    }}
                    emptyLabel="No override"
                    showBadge
                  />

                  <Typography variant="subtitle2" color="text.secondary" className="mb-2 mt-4">
                    File Structure Override
                  </Typography>

                  <FormControl fullWidth className="mb-1">
                    <InputLabel id="download-file-structure-label">Video File Structure</InputLabel>
                    <Select
                      labelId="download-file-structure-label"
                      value={fileStructure}
                      onChange={(e: SelectChangeEvent<string>) => {
                        setFileStructure(e.target.value as FileStructureChoice);
                        setHasUserInteracted(true);
                      }}
                      label="Video File Structure"
                    >
                      <MenuItem value="inherit">Use channel/global settings</MenuItem>
                      <MenuItem value="flat">Force flat (no video subfolders)</MenuItem>
                      <MenuItem value="subfolders">Force individual video subfolders</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" className="mb-4 block">
                    Flat saves files directly in the channel folder; individual subfolders creates a
                    folder per video. &quot;Use channel/global settings&quot; applies each channel&apos;s own
                    setting, or the global default.
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
