import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  TextField,
  FormHelperText,
  Grid,
  Box,
  Alert,
  AlertTitle,
  Typography,
} from '@mui/material';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState } from '../types';

interface DownloadPerformanceSectionProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

export const DownloadPerformanceSection: React.FC<DownloadPerformanceSectionProps> = ({
  config,
  onConfigChange,
  onMobileTooltipClick,
}) => {
  return (
    <ConfigurationAccordion
      title="Download Performance Settings"
      chipLabel={config.enableStallDetection ? "Stall Detection On" : "Stall Detection Off"}
      chipColor={config.enableStallDetection ? "success" : "default"}
      defaultExpanded={false}
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>Performance Optimization</AlertTitle>
        <Typography variant="body2">
          Configure download timeouts, retry attempts, and stall detection to handle slow or interrupted downloads automatically.
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="socket-timeout-label">Socket Timeout</InputLabel>
            <Select
              labelId="socket-timeout-label"
              value={config.downloadSocketTimeoutSeconds ?? 30}
              onChange={(e) => onConfigChange({ downloadSocketTimeoutSeconds: Number(e.target.value) })}
              label="Socket Timeout"
            >
              <MenuItem value={5}>5 seconds</MenuItem>
              <MenuItem value={10}>10 seconds</MenuItem>
              <MenuItem value={20}>20 seconds</MenuItem>
              <MenuItem value={30}>30 seconds</MenuItem>
            </Select>
            <FormHelperText>
              Connection timeout for each download attempt
            </FormHelperText>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="throttled-rate-label">Throttled Rate Detection</InputLabel>
            <Select
              labelId="throttled-rate-label"
              value={config.downloadThrottledRate ?? '100K'}
              onChange={(e) => onConfigChange({ downloadThrottledRate: e.target.value })}
              label="Throttled Rate Detection"
            >
              <MenuItem value="20K">20 KB/s</MenuItem>
              <MenuItem value="50K">50 KB/s</MenuItem>
              <MenuItem value="100K">100 KB/s</MenuItem>
              <MenuItem value="250K">250 KB/s</MenuItem>
              <MenuItem value="500K">500 KB/s</MenuItem>
              <MenuItem value="1M">1 MB/s</MenuItem>
              <MenuItem value="2M">2 MB/s</MenuItem>
            </Select>
            <FormHelperText>
              Minimum speed before considering download throttled
            </FormHelperText>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="download-retries-label">Download Retries</InputLabel>
            <Select
              labelId="download-retries-label"
              value={config.downloadRetryCount ?? 2}
              onChange={(e) => onConfigChange({ downloadRetryCount: Number(e.target.value) })}
              label="Download Retries"
            >
              <MenuItem value={0}>No retries</MenuItem>
              <MenuItem value={1}>1 retry</MenuItem>
              <MenuItem value={2}>2 retries</MenuItem>
              <MenuItem value={3}>3 retries</MenuItem>
            </Select>
            <FormHelperText>
              Number of retry attempts for failed downloads
            </FormHelperText>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={config.enableStallDetection !== false}
                onChange={(e) => onConfigChange({ enableStallDetection: e.target.checked })}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Enable Stall Detection
                <InfoTooltip
                  text="Automatically detect and retry downloads that stall at slow speeds"
                  onMobileClick={onMobileTooltipClick}
                />
              </Box>
            }
          />
        </Grid>

        {config.enableStallDetection && (
          <>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Stall Detection Window (seconds)"
                type="number"
                inputProps={{ min: 5, max: 120, step: 5 }}
                value={config.stallDetectionWindowSeconds ?? 30}
                onChange={(e) => onConfigChange({ stallDetectionWindowSeconds: Number(e.target.value) })}
                helperText="How long the download must stay below the stall threshold before retry logic kicks in"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="stall-threshold-rate-label">Stall Threshold Rate</InputLabel>
                <Select
                  labelId="stall-threshold-rate-label"
                  value={config.stallDetectionRateThreshold ?? config.downloadThrottledRate ?? '100K'}
                  onChange={(e) => onConfigChange({ stallDetectionRateThreshold: e.target.value })}
                  label="Stall Threshold Rate"
                >
                  <MenuItem value="20K">20 KB/s</MenuItem>
                  <MenuItem value="50K">50 KB/s</MenuItem>
                  <MenuItem value="100K">100 KB/s</MenuItem>
                  <MenuItem value="250K">250 KB/s</MenuItem>
                  <MenuItem value="500K">500 KB/s</MenuItem>
                  <MenuItem value="1M">1 MB/s</MenuItem>
                  <MenuItem value="2M">2 MB/s</MenuItem>
                </Select>
                <FormHelperText>
                  Speed threshold for stall detection (defaults to throttled rate)
                </FormHelperText>
              </FormControl>
            </Grid>
          </>
        )}
      </Grid>
    </ConfigurationAccordion>
  );
};
