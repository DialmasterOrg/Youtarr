import React from 'react';
import {
  Alert,
  Button,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '../../ui';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { ConfigState, LoggingStatus } from '../types';
import { useLogDownload } from '../hooks/useLogDownload';
import { formatFileSize } from '../../../utils/formatters';

type LogLevelSetting = ConfigState['logLevel'];

const LEVEL_OPTIONS: Array<{ value: Exclude<LogLevelSetting, ''>; label: string }> = [
  { value: 'warn', label: 'Warn' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
];

interface LoggingSectionProps {
  config: ConfigState;
  savedLogLevel: LogLevelSetting;
  loggingStatus: LoggingStatus | null;
  token: string | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
}

function describeCurrentLevel(savedLogLevel: LogLevelSetting, envLevel: string | undefined): string {
  if (savedLogLevel) {
    return `Current level: ${savedLogLevel}, set on this page.`;
  }
  return envLevel
    ? `Current level: ${envLevel}, from the LOG_LEVEL environment variable.`
    : 'Current level: from the LOG_LEVEL environment variable.';
}

export function LoggingSection({
  config,
  savedLogLevel,
  loggingStatus,
  token,
  onConfigChange,
}: LoggingSectionProps) {
  const { downloading, error: downloadError, downloadLogs } = useLogDownload(token);
  const envLevel = loggingStatus?.envLevel;
  const fileStatus = loggingStatus?.file;
  const folderError = fileStatus?.error ? ` (${fileStatus.error})` : '';

  const handleLevelChange = (event: SelectChangeEvent) => {
    onConfigChange({ logLevel: event.target.value as LogLevelSetting });
  };

  return (
    <>
      <ConfigurationCard title="Log level">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <InputLabel>Log level</InputLabel>
            <Select fullWidth value={config.logLevel} onChange={handleLevelChange}>
              <MenuItem value="">{envLevel ? `Default (${envLevel})` : 'Default'}</MenuItem>
              {LEVEL_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Default uses the LOG_LEVEL environment variable. A new level applies as soon as you
              save, without a restart. Debug helps while reproducing a problem; switch back
              afterwards because it logs a lot.
            </FormHelperText>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              {describeCurrentLevel(savedLogLevel, envLevel)}
            </Typography>
          </Grid>
        </Grid>
      </ConfigurationCard>

      <ConfigurationCard title="Log files">
        <div className="flex flex-col gap-4">
          {fileStatus?.enabled && (
            <Typography variant="body2" color="text.secondary">
              {`Logs are saved in the logs folder inside your Youtarr config folder. A new file starts at ${formatFileSize(fileStatus.maxSizeBytes)}, and the ${fileStatus.maxFiles} most recent older files are kept.`}
            </Typography>
          )}
          {fileStatus && !fileStatus.enabled && (
            <Alert severity="warning">
              {`Log files are off because Youtarr cannot write to its logs folder${folderError}. Logs still go to the container output (docker logs).`}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            Downloads hide the API keys, tokens and proxy passwords Youtarr knows about. Logs can
            still include video titles, channel names, file paths and server addresses, so check them
            before sharing.
          </Typography>
          <div>
            <Button
              variant="contained"
              disabled={!token || downloading}
              onClick={() => {
                void downloadLogs();
              }}
            >
              {downloading ? 'Preparing download...' : 'Download logs'}
            </Button>
          </div>
          {downloadError && <Alert severity="error">{downloadError}</Alert>}
        </div>
      </ConfigurationCard>
    </>
  );
}

export default LoggingSection;
