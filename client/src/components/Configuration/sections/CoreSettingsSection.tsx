import React, { ChangeEvent, useState } from 'react';
import {
  SelectChangeEvent,
  Card,
  CardActionArea,
  CardContent,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Collapse,
  CircularProgress,
  Link,
  Radio,
  Typography,
} from '@mui/material';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { InfoTooltip } from '../common/InfoTooltip';
import SubtitleLanguageSelector from '../SubtitleLanguageSelector';
import { SubfolderAutocomplete } from '../../shared/SubfolderAutocomplete';
import { useSubfolders } from '../../../hooks/useSubfolders';
import { useThemeEngine } from '../../../contexts/ThemeEngineContext';
import { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../types';
import { reverseFrequencyMapping, getChannelFilesOptions } from '../helpers';
import { FREQUENCY_MAPPING } from '../constants';
import { RATING_OPTIONS } from '../../../utils/ratings';

interface CoreSettingsSectionProps {
  config: ConfigState;
  deploymentEnvironment: DeploymentEnvironment;
  isPlatformManaged: PlatformManagedState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
  token: string | null;
}

export const CoreSettingsSection: React.FC<CoreSettingsSectionProps> = ({
  config,
  deploymentEnvironment,
  isPlatformManaged,
  onConfigChange,
  onMobileTooltipClick,
  token,
}) => {
  const { themeMode, setThemeMode, motionEnabled, setMotionEnabled } = useThemeEngine();
  // Fetch available subfolders
  const { subfolders, loading: subfoldersLoading } = useSubfolders(token);

  // State for confirmation dialog when setting default subfolder
  const [pendingDefaultSubfolder, setPendingDefaultSubfolder] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [affectedChannels, setAffectedChannels] = useState<{ count: number; channelNames: string[] }>({ count: 0, channelNames: [] });
  const [loadingAffectedChannels, setLoadingAffectedChannels] = useState(false);
  const [showAffectedList, setShowAffectedList] = useState(false);

  // Handle default subfolder change with confirmation
  const handleDefaultSubfolderChange = async (newValue: string | null) => {
    const currentValue = config.defaultSubfolder || '';
    const newValueNormalized = newValue || '';

    // No change
    if (currentValue === newValueNormalized) {
      return;
    }

    // Show dialog immediately with loading state
    setPendingDefaultSubfolder(newValue);
    setShowConfirmDialog(true);
    setLoadingAffectedChannels(true);
    setAffectedChannels({ count: 0, channelNames: [] });

    // Fetch affected channels count
    try {
      const response = await fetch('/api/channels/using-default-subfolder', {
        headers: { 'x-access-token': token || '' },
      });
      if (response.ok) {
        const data = await response.json();
        setAffectedChannels(data);
      }
    } catch (err) {
      console.error('Failed to fetch affected channels:', err);
      setAffectedChannels({ count: 0, channelNames: [] });
    } finally {
      setLoadingAffectedChannels(false);
    }
  };

  const handleConfirmDefaultSubfolder = () => {
    onConfigChange({ defaultSubfolder: pendingDefaultSubfolder || '' });
    setShowConfirmDialog(false);
    setPendingDefaultSubfolder(null);
    setShowAffectedList(false);
  };

  const handleCancelDefaultSubfolder = () => {
    setShowConfirmDialog(false);
    setPendingDefaultSubfolder(null);
    setShowAffectedList(false);
  };

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
            <SubfolderAutocomplete
              mode="global"
              value={config.defaultSubfolder || null}
              onChange={handleDefaultSubfolderChange}
              subfolders={subfolders}
              loading={subfoldersLoading}
              label="Default Subfolder"
              helperText="Default download location for channels using 'Default Subfolder'"
            />
            <InfoTooltip
              text="Set the default download location for untracked channels and channels using 'Default Subfolder'. Leave empty to download to the root directory by default."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControl fullWidth>
              <InputLabel>Max Content Rating</InputLabel>
              <Select
                value={config.maxContentRating}
                onChange={(e: SelectChangeEvent<string>) =>
                  onConfigChange({ maxContentRating: e.target.value })
                }
                label="Max Content Rating"
              >
                {RATING_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <InfoTooltip
              text="Globally block videos above this content rating during downloads. Applies to channel and manual downloads."
              onMobileClick={onMobileTooltipClick}
            />
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
                  Use external temp directory
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
                  : 'Controls where downloads are staged before moving to final location. When enabled, uses external /tmp path (useful for slow network storage). When disabled, uses a hidden .youtarr_tmp/ folder in your output directory (faster for local/SSD storage). Both options hide in-progress files from media servers.'
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

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Visual Style
            </Typography>
            <InfoTooltip
              text="Choose between the Playful Geometric and Neumorphic Soft UI visual systems."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              border: '2px solid var(--border-strong)',
              boxShadow: themeMode === 'playful' ? 'var(--shadow-hard)' : 'var(--shadow-soft)',
              transition: 'all 300ms var(--transition-bouncy)',
            }}
          >
            <CardActionArea
              onClick={() => setThemeMode('playful')}
              aria-label="Select Playful Geometric theme"
              sx={{ height: '100%' }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Playful Geometric
                  </Typography>
                  <Radio checked={themeMode === 'playful'} />
                </Box>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: '#fffdf5',
                    border: '2px solid #1e293b',
                    boxShadow: '4px 4px 0px 0px #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: '#f472b6' }} />
                  <Box sx={{ width: 32, height: 8, borderRadius: 999, bgcolor: '#fbbf24' }} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Warm cream surface, punchy shadows, and playful motion accents.
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              border: '2px solid var(--border-strong)',
              boxShadow: themeMode === 'neumorphic' ? 'var(--shadow-hard)' : 'var(--shadow-soft)',
              transition: 'all 300ms var(--transition-bouncy)',
            }}
          >
            <CardActionArea
              onClick={() => setThemeMode('neumorphic')}
              aria-label="Select Neumorphic Soft UI theme"
              sx={{ height: '100%' }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Neumorphic Soft UI
                  </Typography>
                  <Radio checked={themeMode === 'neumorphic'} />
                </Box>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: '#e0e5ec',
                    boxShadow:
                      '9px 9px 16px rgba(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box
                    className="neumo-float"
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '999px',
                      boxShadow:
                        'inset 6px 6px 10px rgba(163, 177, 198, 0.6), inset -6px -6px 10px rgba(255, 255, 255, 0.5)',
                    }}
                  />
                  <Box
                    className="neumo-rotate"
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '999px',
                      boxShadow:
                        '9px 9px 16px rgba(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)',
                    }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Cool grey clay, dual shadows, and soft ambient depth.
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={motionEnabled}
                  onChange={(event) => setMotionEnabled(event.target.checked)}
                />
              }
              label="Enable Theme Animations & Wiggles"
            />
            <InfoTooltip
              text="Master toggle for all theme animations, wiggles, and motion accents. Disabling this forces transitions to 0ms."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>
      </Grid>

      {/* Confirmation Dialog for Default Subfolder */}
      <Dialog open={showConfirmDialog} onClose={handleCancelDefaultSubfolder}>
        <DialogTitle>Set Default Subfolder?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Setting a default subfolder will affect where videos are downloaded for:
          </DialogContentText>
          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
            <li>Untracked channels (manual URL downloads)</li>
            <li>Channels configured to use &quot;Default Subfolder&quot;</li>
          </Box>

          {/* Affected channels section */}
          <Box sx={{ mt: 2, mb: 2 }}>
            {loadingAffectedChannels ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <DialogContentText component="span">
                  Checking affected channels...
                </DialogContentText>
              </Box>
            ) : affectedChannels.count === 0 ? (
              <DialogContentText>
                No tracked channels are currently using Default Subfolder.
              </DialogContentText>
            ) : (
              <>
                <DialogContentText>
                  {affectedChannels.count} tracked channel{affectedChannels.count !== 1 ? 's' : ''} configured to use Default Subfolder.
                </DialogContentText>
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => setShowAffectedList(!showAffectedList)}
                  sx={{ mt: 0.5, display: 'block', cursor: 'pointer' }}
                >
                  {showAffectedList ? 'Hide affected channels ▲' : 'Show affected channels ▼'}
                </Link>
                <Collapse in={showAffectedList}>
                  <Box
                    component="ul"
                    sx={{
                      mt: 1,
                      pl: 2,
                      maxHeight: 200,
                      overflow: 'auto',
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      py: 1,
                    }}
                  >
                    {affectedChannels.channelNames.map((name, index) => (
                      <li key={index}>{name}</li>
                    ))}
                  </Box>
                </Collapse>
              </>
            )}
          </Box>

          <DialogContentText>
            Videos will be downloaded to channel folders in:{' '}
            <strong>
              {pendingDefaultSubfolder ? `__${pendingDefaultSubfolder}` : 'the root directory'}
            </strong>
          </DialogContentText>
          <DialogContentText sx={{ mt: 1, fontStyle: 'italic' }}>
            Existing videos will not be moved. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDefaultSubfolder}>Cancel</Button>
          <Button onClick={handleConfirmDefaultSubfolder} variant="contained" color="primary">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </ConfigurationCard>
  );
};
