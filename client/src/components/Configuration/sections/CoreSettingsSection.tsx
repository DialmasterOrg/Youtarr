import React, { ChangeEvent, useState } from 'react';
import {
  SelectChangeEvent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  Typography,
  Divider,
} from '../../ui';
import { CheckCircle2 as CheckCircleIcon, Download as SystemUpdateIcon, ArrowRight as ArrowForwardIcon } from 'lucide-react';
import { YtDlpVersionInfo, YtDlpUpdateStatus } from '../hooks/useYtDlpUpdate';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { InfoTooltip } from '../common/InfoTooltip';
import SubtitleLanguageSelector from '../SubtitleLanguageSelector';
import { SubfolderAutocomplete } from '../../shared/SubfolderAutocomplete';
import { useSubfolders } from '../../../hooks/useSubfolders';
import { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../types';
import { reverseFrequencyMapping, getChannelFilesOptions } from '../helpers';
import { FREQUENCY_MAPPING } from '../constants';

interface CoreSettingsSectionProps {
  config: ConfigState;
  deploymentEnvironment: DeploymentEnvironment;
  isPlatformManaged: PlatformManagedState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
  token: string | null;
  ytDlpVersionInfo?: YtDlpVersionInfo;
  ytDlpUpdateStatus?: YtDlpUpdateStatus;
  onYtDlpUpdate?: () => void;
}

export const CoreSettingsSection: React.FC<CoreSettingsSectionProps> = ({
  config,
  deploymentEnvironment,
  isPlatformManaged,
  onConfigChange,
  onMobileTooltipClick,
  token,
  ytDlpVersionInfo,
  ytDlpUpdateStatus,
  onYtDlpUpdate,
}) => {
  // Fetch available subfolders
  const { subfolders, loading: subfoldersLoading } = useSubfolders(token);

  // State for confirmation dialog when setting default subfolder
  const [pendingDefaultSubfolder, setPendingDefaultSubfolder] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [affectedChannels, setAffectedChannels] = useState<{ count: number; channelNames: string[] }>({ count: 0, channelNames: [] });
  const [loadingAffectedChannels, setLoadingAffectedChannels] = useState(false);
  const [showAffectedList, setShowAffectedList] = useState(false);
  const [showYtDlpUpdateDialog, setShowYtDlpUpdateDialog] = useState(false);

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

  const handleChannelFilesChange = (event: SelectChangeEvent<string>) => {
    onConfigChange({ channelFilesToDownload: Number(event.target.value) });
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
    >
      <Grid container spacing={2} className="mt-2">
        <Grid item xs={12}>
          <Accordion defaultExpanded style={{ border: 'var(--border-weight) solid var(--border)', borderRadius: 'var(--radius-ui)' }}>
            <AccordionSummary>
              <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                General Settings
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Box className="flex items-center">
                    <FormControlLabel
                      control={
                        <Switch
                          name="channelVideosHotLoad"
                          checked={config.channelVideosHotLoad}
                          onChange={handleCheckboxChange}
                        />
                      }
                      label="Enable Hot Loading"
                    />
                    <InfoTooltip
                      text="When enabled, channel lists, channel videos, and download history use infinite hot loading. When disabled, they use page-by-page controls."
                      onMobileClick={onMobileTooltipClick}
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box className="flex items-center">
                    <FormControlLabel
                      control={
                        <Switch
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

                <Grid item xs={12} md={6}>
                  <Box className="flex items-center">
                    <FormControlLabel
                      control={
                        <Switch
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

                {config.subtitlesEnabled && (
                  <Grid item xs={12} md={6}>
                    <Box className="flex items-start">
                      <SubtitleLanguageSelector
                        value={config.subtitleLanguage}
                        onChange={(value) => onConfigChange({ subtitleLanguage: value })}
                      />
                      <Box className="flex items-center min-h-[48px] mt-5">
                        <InfoTooltip
                          text="Select one or more subtitle languages. Subtitles will be downloaded when available; videos without subtitles will still download successfully."
                          onMobileClick={onMobileTooltipClick}
                        />
                      </Box>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          <Accordion defaultExpanded style={{ border: 'var(--border-weight) solid var(--border)', borderRadius: 'var(--radius-ui)' }}>
            <AccordionSummary>
              <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                Download Settings
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Download Frequency</InputLabel>
                    <Box className="flex items-center gap-1">
                      <Select
                        value={currentFrequency}
                        onChange={(e: SelectChangeEvent<string>) =>
                          handleSelectChange(e as any, 'channelDownloadFrequency')
                        }
                        label="Download Frequency"
                        disabled={!config.channelAutoDownload}
                        className="flex-1 min-w-0"
                      >
                        {Object.keys(FREQUENCY_MAPPING).map((key) => (
                          <MenuItem key={key} value={key}>
                            {key}
                          </MenuItem>
                        ))}
                      </Select>
                      <InfoTooltip
                        text="How often to run automatic channel video downloads."
                        onMobileClick={onMobileTooltipClick}
                      />
                    </Box>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Files to Download per Channel</InputLabel>
                    <Box className="flex items-center gap-1">
                      <Select
                        value={config.channelFilesToDownload}
                        onChange={handleChannelFilesChange}
                        label="Videos to Download per Channel Tab"
                        className="flex-1 min-w-0"
                      >
                        {getChannelFilesOptions(config.channelFilesToDownload).map(count => (
                          <MenuItem key={count} value={count}>
                            {count} {count === 1 ? 'video' : 'videos'}
                          </MenuItem>
                        ))}
                      </Select>
                      <InfoTooltip
                        text="How many videos (starting from most recently uploaded) Youtarr will attempt to download per tab when channel downloads run. Already downloaded videos will be skipped."
                        onMobileClick={onMobileTooltipClick}
                      />
                    </Box>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Preferred Resolution</InputLabel>
                    <Box className="flex items-center gap-1">
                      <Select
                        value={config.preferredResolution}
                        onChange={(e: SelectChangeEvent<string>) =>
                          onConfigChange({ preferredResolution: e.target.value })
                        }
                        label="Preferred Resolution"
                        className="flex-1 min-w-0"
                      >
                        <MenuItem value="2160">4K (2160p)</MenuItem>
                        <MenuItem value="1440">1440p</MenuItem>
                        <MenuItem value="1080">1080p</MenuItem>
                        <MenuItem value="720">720p</MenuItem>
                        <MenuItem value="480">480p</MenuItem>
                        <MenuItem value="360">360p</MenuItem>
                      </Select>
                      <InfoTooltip
                        text="The resolution we will try to download from YouTube. Note that this is not guaranteed as YouTube may not have your preferred resolution available."
                        onMobileClick={onMobileTooltipClick}
                      />
                    </Box>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Preferred Video Codec</InputLabel>
                    <Box className="flex items-center gap-1">
                      <Select
                        value={config.videoCodec}
                        onChange={(e: SelectChangeEvent<string>) =>
                          onConfigChange({ videoCodec: e.target.value })
                        }
                        label="Preferred Video Codec"
                        className="flex-1 min-w-0"
                      >
                        <MenuItem value="default">Default (No Preference)</MenuItem>
                        <MenuItem value="h264">H.264/AVC (Best Compatibility)</MenuItem>
                        <MenuItem value="h265">H.265/HEVC (Balanced)</MenuItem>
                      </Select>
                      <InfoTooltip
                        text="Select your preferred video codec. Youtarr will download this codec when available, and fall back to other codecs if your preference is not available for a video. H.264 is recommended for Apple TV and maximum device compatibility. VP9 is the default codec for most YouTube videos."
                        onMobileClick={onMobileTooltipClick}
                      />
                    </Box>
                    <Box component="span" className="text-xs text-muted-foreground">
                      Note: H.264 produces larger file sizes but offers maximum compatibility for Apple TV. This is a preference and will fall back to available codecs.
                    </Box>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Accordion style={{ border: 'var(--border-weight) solid var(--border)', borderRadius: 'var(--radius-ui)' }}>
                    <AccordionSummary>
                      <Typography variant="body2" style={{ fontWeight: 600 }}>
                        Jellyfin / Kodi / Emby Setting Information
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" style={{ marginBottom: 8 }}>
                        Control generation of metadata and artwork files that help Kodi, Emby and Jellyfin index your downloads cleanly.
                      </Typography>
                      <Typography variant="body2" style={{ fontWeight: 500, marginBottom: 8 }}>
                        For best results:
                      </Typography>
                      <Typography variant="body2">
                        • Add your download library as Content Type: <strong>Movies</strong>
                        <br />
                        • Under Metadata Readers/Savers, select <strong>Nfo</strong> to read the .nfo files
                        <br />
                        • Uncheck all metadata downloaders since we provide metadata via .nfo files
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                <Grid item xs={12} md={6} className="mt-3">
                  <FormControl>
                    <FormControlLabel
                      control={
                        <Switch
                          name="writeVideoNfoFiles"
                          checked={config.writeVideoNfoFiles}
                          onChange={handleCheckboxChange}
                        />
                      }
                      label={
                        <Box className="flex items-center">
                          Generate video .nfo files
                          <InfoTooltip
                            text="Create .nfo metadata alongside each download so Kodi, Emby and Jellyfin can import videos with full details."
                            onMobileClick={onMobileTooltipClick}
                          />
                        </Box>
                      }
                    />
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6} className="mt-3">
                  <FormControl>
                    <FormControlLabel
                      control={
                        <Switch
                          name="writeChannelPosters"
                          checked={config.writeChannelPosters}
                          onChange={handleCheckboxChange}
                        />
                      }
                      label={
                        <Box className="flex items-center">
                          Copy channel poster.jpg files
                          <InfoTooltip
                            text="Copy channel thumbnails into each channel folder as poster.jpg for media server compatibility."
                            onMobileClick={onMobileTooltipClick}
                          />
                        </Box>
                      }
                    />
                  </FormControl>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          <Accordion defaultExpanded style={{ border: 'var(--border-weight) solid var(--border)', borderRadius: 'var(--radius-ui)' }}>
            <AccordionSummary>
              <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                File Structure Settings
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel htmlFor="youtubeOutputDirectory" className="flex items-center gap-2">
                      YouTube Output Directory
                      <Chip label="Docker Volume" size="small" />
                    </InputLabel>
                    <TextField
                      id="youtubeOutputDirectory"
                      fullWidth
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
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box className="flex items-start">
                    <SubfolderAutocomplete
                      mode="global"
                      value={config.defaultSubfolder || null}
                      onChange={handleDefaultSubfolderChange}
                      subfolders={subfolders}
                      loading={subfoldersLoading}
                      label="Default Subfolder"
                      helperText="Default download location for channels using 'Default Subfolder'"
                    />
                    <Box className="flex items-center min-h-[48px] mt-5">
                      <InfoTooltip
                        text="Set the default download location for untracked channels and channels using 'Default Subfolder'. Leave empty to download to the root directory by default."
                        onMobileClick={onMobileTooltipClick}
                      />
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box className="flex items-center md:mt-5 md:min-h-[48px]">
                    <FormControlLabel
                      control={
                        <Switch
                          name="useTmpForDownloads"
                          checked={config.useTmpForDownloads}
                          onChange={handleCheckboxChange}
                          disabled={isPlatformManaged.useTmpForDownloads}
                        />
                      }
                      label={
                        <Box className="flex items-center gap-2">
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
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>

      {/* yt-dlp Version Section */}
      {ytDlpVersionInfo && ytDlpVersionInfo.currentVersion && (
        <>
          <Divider className="mt-6 mb-4" />
          <Box>
            <Box className="flex items-center gap-3 flex-wrap mb-2">
              <Typography variant="subtitle1" className="font-medium">
                yt-dlp:
              </Typography>
              <Typography
                variant="body1"
                style={{ fontFamily: 'monospace', fontWeight: 500 }}
              >
                {ytDlpVersionInfo.currentVersion}
              </Typography>
              {ytDlpVersionInfo.updateAvailable && ytDlpVersionInfo.latestVersion ? (
                <>
                  <ArrowForwardIcon style={{ fontSize: 16 }} className="text-muted-foreground" />
                  <Typography
                    variant="body1"
                    style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--warning)' }}
                  >
                    {ytDlpVersionInfo.latestVersion}
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    color="warning"
                    startIcon={
                      ytDlpUpdateStatus === 'updating' ? (
                        <CircularProgress size={16} />
                      ) : (
                        <SystemUpdateIcon />
                      )
                    }
                    onClick={() => setShowYtDlpUpdateDialog(true)}
                    disabled={ytDlpUpdateStatus === 'updating'}
                  >
                    {ytDlpUpdateStatus === 'updating' ? 'Updating...' : 'Update'}
                  </Button>
                </>
              ) : (
                <CheckCircleIcon color="success" fontSize="small" />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              yt-dlp is the video download engine. If downloads are failing, try updating yt-dlp to the latest version.
            </Typography>
          </Box>
        </>
      )}

      {/* yt-dlp Update Confirmation Dialog */}
      <Dialog
        open={showYtDlpUpdateDialog}
        onClose={() => setShowYtDlpUpdateDialog(false)}
        aria-labelledby="ytdlp-update-dialog-title"
        aria-describedby="ytdlp-update-dialog-description"
      >
        <DialogTitle id="ytdlp-update-dialog-title">Update yt-dlp?</DialogTitle>
        <DialogContent>
          <DialogContentText id="ytdlp-update-dialog-description">
            This will update yt-dlp from{' '}
            <strong>{ytDlpVersionInfo?.currentVersion || 'current version'}</strong> to{' '}
            <strong>{ytDlpVersionInfo?.latestVersion || 'latest version'}</strong>.
          </DialogContentText>
          <DialogContentText className="mt-4">
            Newer versions are not guaranteed to be fully compatible with Youtarr. Updating is only recommended if you are experiencing issues with downloading videos.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowYtDlpUpdateDialog(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setShowYtDlpUpdateDialog(false);
              onYtDlpUpdate?.();
            }}
            variant="contained"
            color="primary"
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Default Subfolder */}
      <Dialog open={showConfirmDialog} onClose={handleCancelDefaultSubfolder}>
        <DialogTitle>Set Default Subfolder?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Setting a default subfolder will affect where videos are downloaded for:
          </DialogContentText>
          <Box component="ul" className="mt-2 pl-4">
            <li>Untracked channels (manual URL downloads)</li>
            <li>Channels configured to use &quot;Default Subfolder&quot;</li>
          </Box>

          {/* Affected channels section */}
          <Box className="mt-4 mb-4">
            {loadingAffectedChannels ? (
              <Box className="flex items-center gap-2">
                <CircularProgress size={16} />
                  <span>Checking affected channels...</span>
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
                  className="mt-1 block cursor-pointer"
                >
                  {showAffectedList ? 'Hide affected channels ▲' : 'Show affected channels ▼'}
                </Link>
                <Collapse in={showAffectedList}>
                  <Box
                    component="ul"
                    className="mt-2 pl-4 max-h-[200px] overflow-auto bg-muted/50 rounded py-2"
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
          <DialogContentText className="mt-2" style={{ fontStyle: 'italic' }}>
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
