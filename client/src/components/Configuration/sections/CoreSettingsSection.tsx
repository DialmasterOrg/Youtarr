import React, { ChangeEvent } from 'react';
import {
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  TextField,
  Grid,
  Box,
  Chip,
  Switch,
} from '@mui/material';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { InfoTooltip } from '../common/InfoTooltip';
import SubtitleLanguageSelector from '../SubtitleLanguageSelector';
import { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../types';
import { reverseFrequencyMapping, getChannelFilesOptions } from '../helpers';
import { FREQUENCY_MAPPING } from '../constants';

interface CoreSettingsSectionProps {
  config: ConfigState;
  deploymentEnvironment: DeploymentEnvironment;
  isPlatformManaged: PlatformManagedState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

export const CoreSettingsSection: React.FC<CoreSettingsSectionProps> = ({
  config,
  deploymentEnvironment,
  isPlatformManaged,
  onConfigChange,
  onMobileTooltipClick,
}) => {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    let parsedValue: any = value;

    if (name === 'channelFilesToDownload') {
      parsedValue = Number(value);
    }

    onConfigChange({ [name]: parsedValue });
  };

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ [event.target.name]: event.target.checked });
  };

  const handleChannelFilesChange = (event: SelectChangeEvent<number>) => {
    onConfigChange({ channelFilesToDownload: event.target.value as number });
  };

  const handleSelectChange = (
    event: ChangeEvent<{ value: unknown }>,
    name: string
  ) => {
    onConfigChange({ [name]: FREQUENCY_MAPPING[event.target.value as string] });
  };

  const currentFrequency = reverseFrequencyMapping(config.channelDownloadFrequency);

  return (
    <ConfigurationCard
      title="Core Settings"
      subtitle="Required settings for YouTube video downloads"
    >
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                YouTube Output Directory
                <Chip
                  label="Docker Volume"
                  size="small"
                  sx={{ ml: 1 }}
                />
              </Box>
            }
            name="youtubeOutputDirectory"
            value={config.youtubeOutputDirectory}
            onChange={handleInputChange}
            disabled={true}
            helperText={
              deploymentEnvironment.platform?.toLowerCase() === "elfhosted"
                ? "This path is configured by your platform deployment and cannot be changed here."
                : "Configured via YOUTUBE_OUTPUT_DIR environment variable. Edit .env and restart to change."
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Checkbox
                  name="channelAutoDownload"
                  checked={config.channelAutoDownload}
                  onChange={handleCheckboxChange}
                />
              }
              label="Enable Automatic Downloads"
            />
            <InfoTooltip
              text="Globally enable or disable automatic scheduled downloading of videos from your channels. Only tabs that are enabled for your Channels will be checked and downloaded."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControl fullWidth>
              <InputLabel>Download Frequency</InputLabel>
              <Select
                value={currentFrequency}
                onChange={(e: SelectChangeEvent<string>) =>
                  handleSelectChange(e as any, 'channelDownloadFrequency')
                }
                label="Download Frequency"
                disabled={!config.channelAutoDownload}
              >
                {Object.keys(FREQUENCY_MAPPING).map((key) => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <InfoTooltip
              text="How often to run automatic channel video downloads."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControl fullWidth>
              <InputLabel>Files to Download per Channel</InputLabel>
              <Select
                value={config.channelFilesToDownload}
                onChange={handleChannelFilesChange}
                label="Videos to Download per Channel Tab"
              >
                {getChannelFilesOptions(config.channelFilesToDownload).map(count => (
                  <MenuItem key={count} value={count}>
                    {count} {count === 1 ? 'video' : 'videos'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <InfoTooltip
              text="How many videos (starting from most recently uploaded) Youtarr will attempt to download per tab when channel downloads run. Already downloaded videos will be skipped."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControl fullWidth>
              <InputLabel>Preferred Resolution</InputLabel>
              <Select
                value={config.preferredResolution}
                onChange={(e: SelectChangeEvent<string>) =>
                  onConfigChange({ preferredResolution: e.target.value })
                }
                label="Preferred Resolution"
              >
                <MenuItem value="2160">4K (2160p)</MenuItem>
                <MenuItem value="1440">1440p</MenuItem>
                <MenuItem value="1080">1080p</MenuItem>
                <MenuItem value="720">720p</MenuItem>
                <MenuItem value="480">480p</MenuItem>
                <MenuItem value="360">360p</MenuItem>
              </Select>
            </FormControl>
            <InfoTooltip
              text="The resolution we will try to download from YouTube. Note that this is not guaranteed as YouTube may not have your preferred resolution available."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControl fullWidth>
                <InputLabel>Preferred Video Codec</InputLabel>
                <Select
                  value={config.videoCodec}
                  onChange={(e: SelectChangeEvent<string>) =>
                    onConfigChange({ videoCodec: e.target.value })
                  }
                  label="Preferred Video Codec"
                >
                  <MenuItem value="default">Default (No Preference)</MenuItem>
                  <MenuItem value="h264">H.264/AVC (Best Compatibility)</MenuItem>
                  <MenuItem value="h265">H.265/HEVC (Balanced)</MenuItem>
                </Select>
              </FormControl>
              <InfoTooltip
                text="Select your preferred video codec. Youtarr will download this codec when available, and fall back to other codecs if your preference is not available for a video. H.264 is recommended for Apple TV and maximum device compatibility. VP9 is the default codec for most YouTube videos."
                onMobileClick={onMobileTooltipClick}
              />
            </Box>
            <Box component="span" sx={{ mt: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>
              Note: H.264 produces larger file sizes but offers maximum compatibility for Apple TV. This is a preference and will fall back to available codecs.
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Checkbox
                  name="useTmpForDownloads"
                  checked={config.useTmpForDownloads}
                  onChange={handleCheckboxChange}
                  disabled={isPlatformManaged.useTmpForDownloads}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Use tmp dir for download processing
                  {isPlatformManaged.useTmpForDownloads && (
                    <Chip
                      label={deploymentEnvironment.platform?.toLowerCase() === "elfhosted" ? "Managed by Elfhosted" : "Platform Managed"}
                      size="small"
                    />
                  )}
                </Box>
              }
            />
            <InfoTooltip
              text={
                isPlatformManaged.useTmpForDownloads
                  ? 'This setting is managed by your platform deployment and cannot be changed.'
                  : 'Downloads to local /tmp first, then moves to final location when complete. Recommended for network-mounted storage (NFS, SMB, cloud mounts) to improve performance and avoid file locking issues with Plex or other processes reading from the same location. Not needed for local drives or SSDs.'
              }
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Checkbox
                  name="subtitlesEnabled"
                  checked={config.subtitlesEnabled}
                  onChange={handleCheckboxChange}
                />
              }
              label="Enable Subtitle Downloads"
            />
            <InfoTooltip
              text="Download subtitles in SRT format when available. Manual subtitles are preferred, with auto-generated subtitles as fallback."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        {config.subtitlesEnabled && (
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SubtitleLanguageSelector
                value={config.subtitleLanguage}
                onChange={(value) => onConfigChange({ subtitleLanguage: value })}
              />
              <InfoTooltip
                text="Select one or more subtitle languages. Subtitles will be downloaded when available; videos without subtitles will still download successfully."
                onMobileClick={onMobileTooltipClick}
              />
            </Box>
          </Grid>
        )}

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  name="darkModeEnabled"
                  checked={config.darkModeEnabled}
                  onChange={handleCheckboxChange}
                />
              }
              label="Dark Mode"
            />
          </Box>
        </Grid>
      </Grid>
    </ConfigurationCard>
  );
};
