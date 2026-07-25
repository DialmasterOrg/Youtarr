import React, { useState, useEffect, useId } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Grid,
  Box,
  Alert,
  AlertTitle,
  Typography,
  Button,
  CircularProgress,
  TextField,
} from '../../ui';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState, AutoRemovalDryRunResult } from '../types';
import { useAutoRemovalDryRun } from '../hooks/useAutoRemovalDryRun';
import { AutoRemovalWatchedControls } from './components/AutoRemovalWatchedControls';
import { AutoRemovalPreview } from './components/AutoRemovalPreview';
import { AutoRemovalRulesSummary } from './components/AutoRemovalRulesSummary';

interface AutoRemovalSectionProps {
  token: string | null;
  config: ConfigState;
  storageAvailable: boolean | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

const OrDivider: React.FC = () => (
  <Grid item xs={12}>
    <Box className="flex items-center gap-3">
      <Box className="flex-1 border-t border-border" />
      <Typography variant="body2" className="text-muted-foreground font-medium">
        OR
      </Typography>
      <Box className="flex-1 border-t border-border" />
    </Box>
  </Grid>
);

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
    config.autoRemovalVideoAgeThreshold,
    config.autoRemovalWatchedEnabled,
    config.autoRemovalWatchedMinDaysSinceWatched,
    config.autoRemovalWatchedMinVideoAgeDays,
    config.autoRemovalKeepRecentCount
  ]);

  const handleRunDryRun = async () => {
    setAutoRemovalDryRun({ loading: true, result: null, error: null });

    try {
      const result = await runDryRun({
        autoRemovalEnabled: config.autoRemovalEnabled,
        autoRemovalVideoAgeThreshold: config.autoRemovalVideoAgeThreshold,
        autoRemovalFreeSpaceThreshold: config.autoRemovalFreeSpaceThreshold,
        autoRemovalWatchedEnabled: config.autoRemovalWatchedEnabled,
        autoRemovalWatchedMinDaysSinceWatched: config.autoRemovalWatchedMinDaysSinceWatched,
        autoRemovalWatchedMinVideoAgeDays: config.autoRemovalWatchedMinVideoAgeDays,
        autoRemovalKeepRecentCount: config.autoRemovalKeepRecentCount
      });

      setAutoRemovalDryRun({
        loading: false,
        result,
        error: null
      });
    } catch (err: unknown) {
      setAutoRemovalDryRun({
        loading: false,
        result: null,
        error: err instanceof Error ? err.message : 'Failed to preview automatic removal'
      });
    }
  };

  const handleKeepRecentChange = (rawValue: string) => {
    const parsed = parseInt(rawValue, 10);
    onConfigChange({
      autoRemovalKeepRecentCount: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
    });
  };

  const autoRemovalHasStrategy =
    Boolean(config.autoRemovalFreeSpaceThreshold) ||
    Boolean(config.autoRemovalVideoAgeThreshold) ||
    config.autoRemovalWatchedEnabled;

  return (
    <ConfigurationAccordion
      title="Automatic Video Removal"
      chipLabel={config.autoRemovalEnabled ? "Enabled" : "Disabled"}
      chipColor={config.autoRemovalEnabled ? "success" : "default"}
      statusBanner={{
        enabled: config.autoRemovalEnabled,
        label: 'Enable Automatic Video Removal',
        onToggle: (enabled) => onConfigChange({ autoRemovalEnabled: enabled }),
        onText: 'Automatic Removal Enabled',
        offText: 'Automatic Removal Disabled',
      }}
      defaultExpanded={false}
    >
      <Alert severity="warning" className="mb-4">
        <AlertTitle>Automatic Deletion</AlertTitle>
        <Typography variant="body2">
          This feature automatically deletes downloaded videos based on your configured rules.
          Deletions run nightly at 2:00 AM and remove the files from disk. A deleted video can
          only be restored by downloading it again (if it&apos;s still available on YouTube).
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        {config.autoRemovalEnabled && (
          <>
            {!autoRemovalHasStrategy && (
              <Grid item xs={12}>
                <Alert severity="error" className="mb-2">
                  <Typography variant="body2">
                    Enable at least one removal rule below (old videos, watched videos, or
                    low disk space) when automatic removal is enabled.
                  </Typography>
                </Alert>
              </Grid>
            )}

            {storageAvailable === false && (
              <Grid item xs={12}>
                <Alert severity="warning" className="mb-2">
                  <AlertTitle>Space-Based Removal Unavailable</AlertTitle>
                    <Typography variant="body2" className="mb-2">
                    Storage reporting is not available on your system, so the Low disk space rule is unavailable.
                    This can happen with certain mount types like network shares, cloud storage, or virtual filesystems.
                  </Typography>
                  <Typography variant="body2" className="mb-2">
                    Check the storage indicator at the top of this page - if it shows an error or is not present,
                    storage-based auto-removal will not work.
                  </Typography>
                  <Typography variant="body2">
                    <strong>You can still use the Old videos and Watched videos rules</strong>, which don&apos;t require storage reporting.
                  </Typography>
                </Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <Typography variant="body2">
                Videos are removed when they match any enabled rule below.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Box className="rounded-lg border border-border p-4">
                <Typography variant="subtitle2" className="mb-3">
                  Old videos
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id={ageLabelId}>Delete videos older than</InputLabel>
                      <Select
                        labelId={ageLabelId}
                        inputProps={{
                          'data-testid': 'auto-removal-age-select',
                        }}
                        value={config.autoRemovalVideoAgeThreshold || ''}
                        onChange={(e) => onConfigChange({ autoRemovalVideoAgeThreshold: e.target.value })}
                        label="Delete videos older than"
                      >
                        <MenuItem value="">
                          <em>Off</em>
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
                        Applies to every video, watched or not
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            <OrDivider />

            <AutoRemovalWatchedControls
              config={config}
              onConfigChange={onConfigChange}
              onMobileTooltipClick={onMobileTooltipClick}
            />

            {storageAvailable !== false && (
              <>
                <OrDivider />
                <Grid item xs={12}>
                  <Box className="rounded-lg border border-border p-4">
                    <Typography variant="subtitle2" className="mb-3">
                      Low disk space
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Box className="flex items-center">
                          <FormControl fullWidth disabled={storageAvailable === null}>
                            <InputLabel id={freeSpaceLabelId}>When free space falls below</InputLabel>
                            <Select
                              labelId={freeSpaceLabelId}
                              inputProps={{
                                'data-testid': 'auto-removal-free-space-select',
                              }}
                              value={config.autoRemovalFreeSpaceThreshold || ''}
                              onChange={(e) => onConfigChange({ autoRemovalFreeSpaceThreshold: e.target.value })}
                              label="When free space falls below"
                            >
                              <MenuItem value="">
                                <em>Off</em>
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
                                : 'The oldest videos are deleted until enough space is freed'}
                            </FormHelperText>
                          </FormControl>
                          <InfoTooltip
                            text="Some mount types (network shares, overlays, bind mounts) may report incorrect free space. Before enabling this, verify that the storage display at the top of this page shows accurate values. If the reported storage is incorrect, do not use space-based removal."
                            onMobileClick={onMobileTooltipClick}
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Box className="rounded-lg border border-border p-4 bg-muted/30">
                <Typography variant="subtitle2" className="mb-1">
                  Always kept
                </Typography>
                <Typography variant="body2" className="text-muted-foreground mb-2">
                  Exceptions that every rule respects.
                </Typography>
                <Typography variant="body2" className="mb-3">
                  • Videos marked as Protected are never automatically removed.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Box className="flex items-center">
                      <TextField
                        fullWidth
                        type="number"
                        label="Keep this many newest downloads"
                        value={config.autoRemovalKeepRecentCount > 0 ? String(config.autoRemovalKeepRecentCount) : ''}
                        onChange={(e) => handleKeepRecentChange(e.target.value)}
                        helperText="Blank or 0 to disable"
                        inputProps={{ min: 0, 'data-testid': 'auto-removal-keep-recent-input' }}
                      />
                      <InfoTooltip
                        text="Protects the newest downloads from every removal rule on this page. For example, with a value of 50, the 50 most recently downloaded videos are always kept, no matter their age or watched state. Protected videos do not count toward this limit. Leave blank or 0 to disable."
                        onMobileClick={onMobileTooltipClick}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            {autoRemovalHasStrategy && (
              <Grid item xs={12}>
                <AutoRemovalRulesSummary config={config} />
              </Grid>
            )}

            <Grid item xs={12}>
              <Box className={`flex items-center gap-2 ${autoRemovalHasStrategy ? 'mt-2' : ''}`}>
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
                <FormHelperText className="mt-2">
                  Enable at least one rule to run a preview.
                </FormHelperText>
              )}
            </Grid>

            {autoRemovalDryRun.error && (
              <Grid item xs={12}>
                <Alert severity="error" className="mt-2">
                  {autoRemovalDryRun.error}
                </Alert>
              </Grid>
            )}

            {autoRemovalDryRun.result && (
              <Grid item xs={12}>
                <AutoRemovalPreview result={autoRemovalDryRun.result} />
              </Grid>
            )}
          </>
        )}
      </Grid>
    </ConfigurationAccordion>
  );
};
