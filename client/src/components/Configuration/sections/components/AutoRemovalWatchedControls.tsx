import React, { useId } from 'react';
import {
  Alert,
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
} from '../../../ui';
import { InfoTooltip } from '../../common/InfoTooltip';
import { ConfigState } from '../../types';

const DAYS_SINCE_WATCHED_OPTIONS = ['1', '3', '7', '14', '30', '60', '90'];
const MIN_VIDEO_AGE_OPTIONS = ['7', '14', '30', '60', '90', '180', '365'];

interface AutoRemovalWatchedControlsProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

export const AutoRemovalWatchedControls: React.FC<AutoRemovalWatchedControlsProps> = ({
  config,
  onConfigChange,
  onMobileTooltipClick,
}) => {
  const daysSinceWatchedLabelId = useId();
  const minVideoAgeLabelId = useId();

  return (
    <Grid item xs={12}>
      <Box className="rounded-lg border border-border p-4">
        <Box className="flex items-center">
          <FormControlLabel
            control={
              <Switch
                checked={config.autoRemovalWatchedEnabled}
                onChange={(e) => onConfigChange({ autoRemovalWatchedEnabled: e.target.checked })}
              />
            }
            label="Remove watched videos"
          />
          <InfoTooltip
            text="Removes videos after they have been watched on your media server(s). What counts as watched follows the rule configured in Watch Status settings. Videos that have never been synced are treated as unwatched and are never removed by this rule."
            onMobileClick={onMobileTooltipClick}
          />
        </Box>

        {config.autoRemovalWatchedEnabled && (
          <Grid container spacing={2} className="mt-1">
            {config.watchStatusSyncEnabled === false && (
              <Grid item xs={12}>
                <Alert severity="warning">
                  <Typography variant="body2">
                    Watch status sync is disabled, so watched-based removal will be skipped.
                    Enable it in Watch Status settings for this rule to take effect.
                  </Typography>
                </Alert>
              </Grid>
            )}

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id={daysSinceWatchedLabelId}>Wait after last watch</InputLabel>
                <Select
                  labelId={daysSinceWatchedLabelId}
                  inputProps={{ 'data-testid': 'auto-removal-watched-days-select' }}
                  value={config.autoRemovalWatchedMinDaysSinceWatched || ''}
                  onChange={(e) => onConfigChange({ autoRemovalWatchedMinDaysSinceWatched: e.target.value })}
                  label="Wait after last watch"
                >
                  <MenuItem value="">
                    <em>No wait - remove once watched</em>
                  </MenuItem>
                  {DAYS_SINCE_WATCHED_OPTIONS.map((days) => (
                    <MenuItem key={days} value={days}>
                      {days === '1' ? '1 day' : `${days} days`}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Time that must pass since the most recent watch
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id={minVideoAgeLabelId}>Minimum time since download</InputLabel>
                <Select
                  labelId={minVideoAgeLabelId}
                  inputProps={{ 'data-testid': 'auto-removal-watched-age-select' }}
                  value={config.autoRemovalWatchedMinVideoAgeDays || ''}
                  onChange={(e) => onConfigChange({ autoRemovalWatchedMinVideoAgeDays: e.target.value })}
                  label="Minimum time since download"
                >
                  <MenuItem value="">
                    <em>Any age</em>
                  </MenuItem>
                  {MIN_VIDEO_AGE_OPTIONS.map((days) => (
                    <MenuItem key={days} value={days}>
                      {`${days} days`}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Only remove watched videos downloaded at least this long ago
                </FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        )}
      </Box>
    </Grid>
  );
};
