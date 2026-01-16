import React, { useState, useEffect, useId } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  FormHelperText,
  Grid,
  Box,
  Alert,
  AlertTitle,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState, AutoRemovalDryRunResult } from '../types';
import { formatBytes } from '../helpers';
import { useAutoRemovalDryRun } from '../hooks/useAutoRemovalDryRun';

interface AutoRemovalSectionProps {
  token: string | null;
  config: ConfigState;
  storageAvailable: boolean | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

export const AutoRemovalSection: React.FC<AutoRemovalSectionProps> = ({
  token,
  config,
  storageAvailable,
  onConfigChange,
  onMobileTooltipClick,
}) => {
  const [autoRemovalDryRun, setAutoRemovalDryRun] = useState<{
    loading: boolean;
    result: AutoRemovalDryRunResult | null;
    error: string | null;
  }>({
    loading: false,
    result: null,
    error: null
  });

  const { runDryRun } = useAutoRemovalDryRun({ token });
  const freeSpaceLabelId = useId();
  const ageLabelId = useId();

  // Reset dry run results when configuration changes
  // This ensures stale preview results aren't shown for different settings
  // NOTE: We intentionally do NOT include autoRemovalDryRun state in dependencies
  // to prevent the effect from triggering when results are set, which would
  // immediately clear them. We only want to clear when config values change.
  useEffect(() => {
    setAutoRemovalDryRun({
      loading: false,
      result: null,
      error: null
    });
  }, [
    config.autoRemovalEnabled,
    config.autoRemovalFreeSpaceThreshold,
    config.autoRemovalVideoAgeThreshold
  ]);

  const handleRunDryRun = async () => {
    setAutoRemovalDryRun({ loading: true, result: null, error: null });

    try {
      const result = await runDryRun({
        autoRemovalEnabled: config.autoRemovalEnabled,
        autoRemovalVideoAgeThreshold: config.autoRemovalVideoAgeThreshold,
        autoRemovalFreeSpaceThreshold: config.autoRemovalFreeSpaceThreshold
      });

      setAutoRemovalDryRun({
        loading: false,
        result,
        error: null
      });
    } catch (err: any) {
      setAutoRemovalDryRun({
        loading: false,
        result: null,
        error: err?.message || 'Failed to preview automatic removal'
      });
    }
  };

  const autoRemovalHasStrategy = Boolean(config.autoRemovalFreeSpaceThreshold) || Boolean(config.autoRemovalVideoAgeThreshold);
  const dryRunPlan = autoRemovalDryRun.result?.plan;
  const dryRunSimulation = autoRemovalDryRun.result?.simulationTotals;
  const dryRunSampleVideos = dryRunPlan
    ? [...(dryRunPlan.ageStrategy.sampleVideos || []), ...(dryRunPlan.spaceStrategy.sampleVideos || [])].slice(0, 5)
    : [];
  const hasDryRunSpaceThreshold = dryRunPlan?.spaceStrategy.thresholdBytes != null;

  return (
    <ConfigurationAccordion
      title="Automatic Video Removal"
      chipLabel={config.autoRemovalEnabled ? "Enabled" : "Disabled"}
      chipColor={config.autoRemovalEnabled ? "success" : "default"}
      defaultExpanded={false}
    >
      <Alert severity="warning" sx={{ mb: 2 }}>
        <AlertTitle>Automatic Deletion</AlertTitle>
        <Typography variant="body2">
          This feature automatically deletes downloaded videos based on your configured thresholds.
          Deletions run nightly at 2:00 AM and are permanent - deleted videos cannot be recovered.
          <br /><br />
          Use this feature to manage storage automatically and keep only recent content.
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={config.autoRemovalEnabled}
                onChange={(e) => onConfigChange({ autoRemovalEnabled: e.target.checked })}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Enable Automatic Video Removal
                <InfoTooltip
                  text="Automatically delete videos based on the thresholds configured below. Deletions run nightly at 2:00 AM."
                  onMobileClick={onMobileTooltipClick}
                />
              </Box>
            }
          />
        </Grid>

        {config.autoRemovalEnabled && (
          <>
            {!autoRemovalHasStrategy && (
              <Grid item xs={12}>
                <Alert severity="error" sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    You must configure at least one removal threshold (Free Space or Video Age) when automatic removal is enabled.
                  </Typography>
                </Alert>
              </Grid>
            )}

            {storageAvailable === false && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ mb: 1 }}>
                  <AlertTitle>Space-Based Removal Unavailable</AlertTitle>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Storage reporting is not available on your system, so the Free Space Threshold option is disabled.
                    This can happen with certain mount types like network shares, cloud storage, or virtual filesystems.
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Check the storage indicator at the top of this page - if it shows an error or is not present,
                    storage-based auto-removal will not work.
                  </Typography>
                  <Typography variant="body2">
                    <strong>You can still use Age-Based Removal</strong> (see below), which doesn&apos;t require storage reporting.
                  </Typography>
                </Alert>
              </Grid>
            )}

            {storageAvailable !== false && (
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControl fullWidth disabled={storageAvailable === null}>
                    <InputLabel id={freeSpaceLabelId}>Free Space Threshold (Optional)</InputLabel>
                    <Select
                      labelId={freeSpaceLabelId}
                      inputProps={{
                        'data-testid': 'auto-removal-free-space-select',
                      }}
                      value={config.autoRemovalFreeSpaceThreshold || ''}
                      onChange={(e) => onConfigChange({ autoRemovalFreeSpaceThreshold: e.target.value })}
                      label="Free Space Threshold (Optional)"
                    >
                      <MenuItem value="">
                        <em>Disabled</em>
                      </MenuItem>
                      <MenuItem value="500MB">500 MB</MenuItem>
                      <MenuItem value="1GB">1 GB</MenuItem>
                      <MenuItem value="2GB">2 GB</MenuItem>
                      <MenuItem value="5GB">5 GB</MenuItem>
                      <MenuItem value="10GB">10 GB</MenuItem>
                      <MenuItem value="20GB">20 GB</MenuItem>
                      <MenuItem value="50GB">50 GB</MenuItem>
                      <MenuItem value="100GB">100 GB</MenuItem>
                    </Select>
                    <FormHelperText>
                      {storageAvailable === null
                        ? 'Checking storage availability...'
                        : 'Delete oldest videos when free space falls below this threshold'}
                    </FormHelperText>
                  </FormControl>
                  <InfoTooltip
                    text="Some mount types (network shares, overlays, bind mounts) may report incorrect free space. Before enabling this, verify that the storage display at the top of this page shows accurate values. If the reported storage is incorrect, do not use space-based removal."
                    onMobileClick={onMobileTooltipClick}
                  />
                </Box>
              </Grid>
            )}

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id={ageLabelId}>Video Age Threshold (Optional)</InputLabel>
                <Select
                  labelId={ageLabelId}
                  inputProps={{
                    'data-testid': 'auto-removal-age-select',
                  }}
                  value={config.autoRemovalVideoAgeThreshold || ''}
                  onChange={(e) => onConfigChange({ autoRemovalVideoAgeThreshold: e.target.value })}
                  label="Video Age Threshold (Optional)"
                >
                  <MenuItem value="">
                    <em>Disabled</em>
                  </MenuItem>
                  <MenuItem value="7">7 days</MenuItem>
                  <MenuItem value="14">14 days</MenuItem>
                  <MenuItem value="30">30 days</MenuItem>
                  <MenuItem value="60">60 days</MenuItem>
                  <MenuItem value="120">120 days</MenuItem>
                  <MenuItem value="180">180 days</MenuItem>
                  <MenuItem value="365">1 year</MenuItem>
                  <MenuItem value="730">2 years</MenuItem>
                  <MenuItem value="1095">3 years</MenuItem>
                  <MenuItem value="1825">5 years</MenuItem>
                </Select>
                <FormHelperText>
                  Delete videos older than this threshold
                </FormHelperText>
              </FormControl>
            </Grid>

            {(config.autoRemovalFreeSpaceThreshold || config.autoRemovalVideoAgeThreshold) && (
              <Grid item xs={12}>
                <Alert severity="success" sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                    Active Removal Strategy:
                  </Typography>
                  <Typography variant="body2" component="div">
                    {config.autoRemovalFreeSpaceThreshold && (
                      <>• Delete oldest videos when free space &lt; <strong>{config.autoRemovalFreeSpaceThreshold}</strong><br /></>
                    )}
                    {config.autoRemovalVideoAgeThreshold && (
                      <>• Delete videos older than <strong>{
                        parseInt(config.autoRemovalVideoAgeThreshold) >= 365
                          ? `${Math.round(parseInt(config.autoRemovalVideoAgeThreshold) / 365)} year${Math.round(parseInt(config.autoRemovalVideoAgeThreshold) / 365) > 1 ? 's' : ''}`
                          : `${config.autoRemovalVideoAgeThreshold} days`
                      }</strong></>
                    )}
                  </Typography>
                </Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: autoRemovalHasStrategy ? 1 : 0 }}>
                <Button
                  variant="outlined"
                  onClick={handleRunDryRun}
                  disabled={autoRemovalDryRun.loading || !autoRemovalHasStrategy}
                >
                  {autoRemovalDryRun.loading ? 'Running preview…' : 'Preview Automatic Removal'}
                </Button>
                {autoRemovalDryRun.loading && <CircularProgress size={18} />}
              </Box>
              {!autoRemovalHasStrategy && (
                <FormHelperText sx={{ mt: 1 }}>
                  Select at least one threshold to run a preview.
                </FormHelperText>
              )}
            </Grid>

            {autoRemovalDryRun.error && (
              <Grid item xs={12}>
                <Alert severity="error" sx={{ mt: 1 }}>
                  {autoRemovalDryRun.error}
                </Alert>
              </Grid>
            )}

            {autoRemovalDryRun.result && dryRunSimulation && (
              <Grid item xs={12}>
                <Alert
                  severity={autoRemovalDryRun.result.errors.length > 0 ? 'warning' : 'info'}
                  sx={{ mt: 1 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    Preview Summary
                  </Typography>
                  <Typography variant="body2">
                    Would remove <strong>{dryRunSimulation.total}</strong> videos (~{formatBytes(dryRunSimulation.estimatedFreedBytes)}).
                  </Typography>
                  {dryRunPlan?.ageStrategy.enabled && dryRunPlan.ageStrategy.candidateCount > 0 && (
                    <Typography variant="body2">
                      • Age threshold: {dryRunPlan.ageStrategy.candidateCount} videos (~{formatBytes(dryRunPlan.ageStrategy.estimatedFreedBytes)})
                    </Typography>
                  )}
                  {dryRunPlan?.spaceStrategy.enabled && dryRunPlan.spaceStrategy.needsCleanup && (
                    <Typography variant="body2">
                      • Space threshold: {dryRunPlan.spaceStrategy.candidateCount} videos (~{formatBytes(dryRunPlan.spaceStrategy.estimatedFreedBytes)})
                    </Typography>
                  )}
                  {hasDryRunSpaceThreshold && dryRunPlan?.spaceStrategy.needsCleanup === false && (
                    <Typography variant="body2">
                      Storage is currently above the free space threshold; no space-based deletions are needed.
                    </Typography>
                  )}
                  {dryRunSampleVideos.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        Sample videos
                      </Typography>
                      {dryRunSampleVideos.map((video) => (
                        <Typography key={`dryrun-video-${video.id}`} variant="body2">
                          {video.title} ({video.youtubeId}) • {formatBytes(video.fileSize)}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  {autoRemovalDryRun.result.errors.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        Warnings
                      </Typography>
                      {autoRemovalDryRun.result.errors.map((err, index) => (
                        <Typography key={`dryrun-warning-${index}`} variant="body2">
                          {err}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Alert>
              </Grid>
            )}
          </>
        )}
      </Grid>
    </ConfigurationAccordion>
  );
};
