import React, { useId } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '../../ui';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { OrDivider } from '../common/OrDivider';
import { StorageSizeInput } from '../common/StorageSizeInput';
import { ConfigState } from '../types';
import { formatBytes, storageSizeToBytes } from '../helpers';
import { DownloadPauseAlert } from '../../shared/DownloadPauseAlert';
import { useDownloadPauseStatus } from '../../../hooks/useDownloadPauseStatus';

const MIN_FREE_SPACE_OPTIONS = [
  { value: '1GB', label: '1 GB' },
  { value: '5GB', label: '5 GB' },
  { value: '10GB', label: '10 GB' },
  { value: '50GB', label: '50 GB' },
  { value: '100GB', label: '100 GB' },
  { value: '250GB', label: '250 GB' },
  { value: '500GB', label: '500 GB' },
  { value: '1TB', label: '1 TB' },
];

/**
 * Settings combinations where automatic removal can never bring storage back
 * within the pause limit, leaving downloads paused indefinitely.
 */
export const getPauseRemovalConflicts = (config: ConfigState): string[] => {
  if (!config.autoRemovalEnabled) {
    return [];
  }
  const conflicts: string[] = [];

  const pauseUsage = storageSizeToBytes(config.downloadPauseUsageLimit);
  const removalUsage = storageSizeToBytes(config.autoRemovalUsageLimit);
  if (pauseUsage !== null && removalUsage !== null && pauseUsage < removalUsage) {
    conflicts.push(
      'The pause limit is lower than the Auto Removal total size limit, so cleanup stops before downloads can resume. Set the pause limit at or above the removal limit.'
    );
  }

  const pauseFree = storageSizeToBytes(config.downloadPauseMinFreeSpace);
  const removalFree = storageSizeToBytes(config.autoRemovalFreeSpaceThreshold);
  if (pauseFree !== null && removalFree !== null && pauseFree > removalFree) {
    conflicts.push(
      'The minimum free space for downloads is higher than the Auto Removal low disk space threshold, so cleanup stops before downloads can resume. Set the pause minimum at or below the removal threshold.'
    );
  }

  return conflicts;
};

interface StorageLimitsSectionProps {
  token: string | null;
  config: ConfigState;
  storageAvailable: boolean | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

export const StorageLimitsSection: React.FC<StorageLimitsSectionProps> = ({
  token,
  config,
  storageAvailable,
  onConfigChange,
  onMobileTooltipClick,
}) => {
  const minFreeSpaceLabelId = useId();
  const { data: pauseStatus } = useDownloadPauseStatus(token);
  // Only values the server can enforce count; a malformed one is ignored there.
  const isActiveLimit = (value: string) => (storageSizeToBytes(value) ?? 0) > 0;
  const hasLimit = isActiveLimit(config.downloadPauseUsageLimit) || isActiveLimit(config.downloadPauseMinFreeSpace);
  const conflicts = getPauseRemovalConflicts(config);
  const downloadedBytes = pauseStatus?.usage.downloadedBytes ?? null;

  return (
    <ConfigurationAccordion
      title="Pause Downloads When Storage Is Full"
      chipLabel={hasLimit ? 'Enabled' : 'Disabled'}
      chipColor={hasLimit ? 'success' : 'default'}
    >
      <Typography variant="body2" className="mb-4">
        Stop all downloads (scheduled, manual, and API) when storage reaches a limit. New download
        requests are refused, and queued downloads wait and then start automatically once storage is
        back within your limits. Both limits are optional; downloads pause when either one is reached.
      </Typography>

      {pauseStatus?.paused ? (
        <DownloadPauseAlert status={pauseStatus} hideSettingsLink className="mb-4" />
      ) : (
        downloadedBytes !== null && (
          <Alert severity="info" className="mb-4">
            <Typography variant="body2">
              Downloads are running. Downloaded videos currently use <strong>{formatBytes(downloadedBytes)}</strong>.
            </Typography>
          </Alert>
        )
      )}

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Box className="rounded-lg border border-border p-4">
            <Typography variant="subtitle2" className="mb-3">
              Total size of downloads
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box className="flex items-center">
                  <StorageSizeInput
                    label="Pause when downloads total more than"
                    value={config.downloadPauseUsageLimit}
                    onChange={(value) => onConfigChange({ downloadPauseUsageLimit: value })}
                    helperText="Blank to turn off"
                    testId="download-pause-usage-limit"
                  />
                  <InfoTooltip
                    text="Adds up the size of every video Youtarr has downloaded (video and MP3 files), using the sizes recorded at download time and refreshed by the nightly rescan. Works on network shares and cloud storage, where free space may be reported incorrectly. Thumbnails, subtitles and metadata files are not counted. A download already in progress is allowed to finish, so the total can briefly go over the limit."
                    onMobileClick={onMobileTooltipClick}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Grid>

        <OrDivider />

        <Grid item xs={12}>
          <Box className="rounded-lg border border-border p-4">
            <Typography variant="subtitle2" className="mb-3">
              Low disk space
            </Typography>
            {storageAvailable === false ? (
              <Alert
                severity="warning"
                action={config.downloadPauseMinFreeSpace ? (
                  <Button size="small" onClick={() => onConfigChange({ downloadPauseMinFreeSpace: '' })}>
                    Turn off
                  </Button>
                ) : undefined}
              >
                <Typography variant="body2">
                  Storage reporting is not available on your system (common with network shares, cloud
                  storage, and some virtual filesystems), so this limit is unavailable. Use the total
                  size limit above instead.
                </Typography>
                {config.downloadPauseMinFreeSpace && (
                  <Typography variant="body2" className="mt-1">
                    A minimum of <strong>{config.downloadPauseMinFreeSpace}</strong> is still saved but cannot be
                    checked, so it has no effect.
                  </Typography>
                )}
              </Alert>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box className="flex items-center">
                    <FormControl fullWidth disabled={storageAvailable === null}>
                      <InputLabel id={minFreeSpaceLabelId}>Pause when free space falls below</InputLabel>
                      <Select
                        labelId={minFreeSpaceLabelId}
                        label="Pause when free space falls below"
                        value={config.downloadPauseMinFreeSpace || ''}
                        onChange={(e) => onConfigChange({ downloadPauseMinFreeSpace: e.target.value })}
                        inputProps={{ 'data-testid': 'download-pause-min-free-space-select' }}
                      >
                        <MenuItem value="">
                          <em>Off</em>
                        </MenuItem>
                        {MIN_FREE_SPACE_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>
                        {storageAvailable === null
                          ? 'Checking storage availability...'
                          : 'Measured on the disk that holds your downloads'}
                      </FormHelperText>
                    </FormControl>
                    <InfoTooltip
                      text="Some mount types (network shares, overlays, bind mounts) may report incorrect free space. Before relying on this, check that the storage indicator shows accurate values. If it does not, use the total size limit instead."
                      onMobileClick={onMobileTooltipClick}
                    />
                  </Box>
                </Grid>
              </Grid>
            )}
          </Box>
        </Grid>

        {conflicts.map((conflict) => (
          <Grid item xs={12} key={conflict}>
            <Alert severity="warning">
              <Typography variant="body2">{conflict}</Typography>
            </Alert>
          </Grid>
        ))}
      </Grid>
    </ConfigurationAccordion>
  );
};

export default StorageLimitsSection;
