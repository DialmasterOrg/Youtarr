import { ScheduleSummary } from './components/ScheduleSummary';
import React, { ChangeEvent, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
} from '../../ui';
import {
  CheckCircle2 as CheckCircleIcon,
  Download as SystemUpdateIcon,
  ArrowRight as ArrowForwardIcon,
} from 'lucide-react';
import { YtDlpVersionInfo, YtDlpUpdateStatus } from '../hooks/useYtDlpUpdate';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../types';
import { formatDateTime } from '../../../utils/formatters';

interface YtdlpUpdateSectionProps {
  config: ConfigState;
  deploymentEnvironment: DeploymentEnvironment;
  isPlatformManaged: PlatformManagedState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
  ytDlpVersionInfo?: YtDlpVersionInfo;
  ytDlpUpdateStatus?: YtDlpUpdateStatus;
  onYtDlpUpdate?: () => void;
}

export const YtdlpUpdateSection: React.FC<YtdlpUpdateSectionProps> = ({
  config,
  deploymentEnvironment,
  isPlatformManaged,
  onConfigChange,
  onMobileTooltipClick,
  ytDlpVersionInfo,
  ytDlpUpdateStatus,
  onYtDlpUpdate,
}) => {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ [event.target.name]: event.target.checked });
  };

  const platformManaged = isPlatformManaged.ytdlpUpdates;
  const isElfhosted = deploymentEnvironment.platform?.toLowerCase() === 'elfhosted';
  const lastChecked = ytDlpVersionInfo?.lastChecked ?? null;
  const lastUpdated = ytDlpVersionInfo?.lastUpdated ?? null;
  const lastResult = ytDlpVersionInfo?.lastResult ?? null;

  return (
    <ConfigurationCard title="yt-dlp Version & Updates">
      {ytDlpVersionInfo?.currentVersion && (
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
          {!platformManaged && ytDlpVersionInfo.updateAvailable && ytDlpVersionInfo.latestVersion ? (
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
                onClick={() => setShowUpdateDialog(true)}
                disabled={ytDlpUpdateStatus === 'updating'}
              >
                {ytDlpUpdateStatus === 'updating' ? 'Updating...' : 'Update'}
              </Button>
            </>
          ) : !platformManaged ? (
            <CheckCircleIcon color="success" fontSize="small" />
          ) : null}
          {platformManaged && (
            <Chip
              label={isElfhosted ? 'Managed by Elfhosted' : 'Platform Managed'}
              size="small"
            />
          )}
        </Box>
      )}

      {platformManaged ? (
        <Typography variant="caption" color="text.secondary">
          yt-dlp is managed by {isElfhosted ? 'Elfhosted' : 'the platform'} and cannot be updated from Youtarr. Updates are applied automatically by the platform.
        </Typography>
      ) : (
        <>
          <Typography variant="caption" color="text.secondary">
            yt-dlp is the video download engine. If downloads are failing, try updating yt-dlp to the latest version.
          </Typography>

          <Box className="mt-4">
            <FormControl fullWidth>
              <InputLabel>Update Channel</InputLabel>
              <Select
                label="Update Channel"
                value={config.ytdlpUpdateChannel || 'stable'}
                onChange={(e) =>
                  onConfigChange({ ytdlpUpdateChannel: e.target.value as 'stable' | 'nightly' })
                }
              >
                <MenuItem value="stable">Stable (recommended)</MenuItem>
                <MenuItem value="nightly">Nightly</MenuItem>
              </Select>
              <FormHelperText>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  Stable is the official tested release. Nightly gets extractor fixes days earlier but may occasionally break.
                  <InfoTooltip
                    text="Youtarr keeps yt-dlp on the selected channel: manual updates, automatic updates, and app restarts all install the latest release of this channel. Switching back to Stable downgrades to the latest stable release."
                    onMobileClick={onMobileTooltipClick}
                  />
                </span>
              </FormHelperText>
            </FormControl>
          </Box>

          <Box className="mt-4 flex items-center">
            <FormControlLabel
              control={
                <Switch
                  name="autoUpdateYtdlp"
                  checked={!!config.autoUpdateYtdlp}
                  onChange={handleCheckboxChange}
                />
              }
              label="Automatically update yt-dlp"
            />
            <InfoTooltip
              text="Checks for a new yt-dlp release on the selected update channel on the configured schedule and installs it automatically. If an update fails, Youtarr keeps running on the previous version."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>

          <ScheduleSummary scheduleKey="ytdlpUpdateFrequency" value={config.ytdlpUpdateFrequency} />

          {(lastChecked || lastResult || lastUpdated) && (
            <Box className="mt-1">
              {lastChecked && (
                <Typography
                  variant="caption"
                  className="block"
                  style={{ color: lastResult?.status === 'error' ? 'var(--warning)' : undefined }}
                  color={lastResult?.status === 'error' ? undefined : 'text.secondary'}
                >
                  Last checked: {formatDateTime(lastChecked)}
                  {lastResult?.status === 'up-to-date' && ' - already up to date'}
                  {lastResult?.status === 'updated' && lastResult.version && ` - updated to ${lastResult.version}`}
                  {lastResult?.status === 'skipped' && ` - skipped: ${lastResult.message || 'reason unknown'}`}
                  {lastResult?.status === 'error' && ` - update failed: ${lastResult.message || 'reason unknown'}`}
                </Typography>
              )}
              {lastUpdated && (
                <Typography variant="caption" color="text.secondary" className="block">
                  Last updated: {formatDateTime(lastUpdated)}
                </Typography>
              )}
            </Box>
          )}
        </>
      )}

      <Dialog
        open={showUpdateDialog}
        onClose={() => setShowUpdateDialog(false)}
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
          <Button onClick={() => setShowUpdateDialog(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setShowUpdateDialog(false);
              onYtDlpUpdate?.();
            }}
            variant="contained"
            color="primary"
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </ConfigurationCard>
  );
};
