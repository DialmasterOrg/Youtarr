import React, { ChangeEvent } from 'react';
import {
  TextField,
  Grid,
  Box,
  Button,
  Alert,
  AlertTitle,
  Typography,
} from '../../ui';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { ConfigState, YouTubeApiKeyStatus } from '../types';

interface YouTubeApiSectionProps {
  config: ConfigState;
  status: YouTubeApiKeyStatus;
  lastValidatedAt: Date | null;
  lastReason: string | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onTestKey: () => void;
}

type ChipColor = 'success' | 'error' | 'warning' | 'info';

function getChipLabel(status: YouTubeApiKeyStatus): string {
  switch (status) {
    case 'valid':
      return 'Valid';
    case 'testing':
      return 'Testing...';
    case 'invalid':
      return 'Invalid';
    case 'quota_exhausted':
      return 'Quota Exhausted';
    case 'rate_limited':
      return 'Rate Limited';
    case 'api_not_enabled':
      return 'API Not Enabled';
    case 'key_restricted':
      return 'Key Restricted';
    case 'network_error':
      return 'Network Error';
    default:
      return 'Not Tested';
  }
}

function getChipColor(status: YouTubeApiKeyStatus): ChipColor {
  switch (status) {
    case 'valid':
      return 'success';
    case 'testing':
      return 'info';
    case 'quota_exhausted':
    case 'rate_limited':
      return 'warning';
    case 'invalid':
    case 'api_not_enabled':
    case 'key_restricted':
    case 'network_error':
      return 'error';
    default:
      return 'warning';
  }
}

export const YouTubeApiSection: React.FC<YouTubeApiSectionProps> = ({
  config,
  status,
  lastValidatedAt,
  lastReason,
  onConfigChange,
  onTestKey,
}) => {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ youtubeApiKey: event.target.value });
  };

  const isTesting = status === 'testing';
  const hasKey = Boolean(config.youtubeApiKey);

  return (
    <ConfigurationAccordion
      title="YouTube Data API (optional)"
      chipLabel={getChipLabel(status)}
      chipColor={getChipColor(status)}
      defaultExpanded={false}
    >
      <Alert severity="info" className="mb-4">
        <AlertTitle>Optional: speed up data fetching</AlertTitle>
        <Typography variant="body2">
          Youtarr can use a YouTube Data API v3 key to fetch channel metadata,
          video metadata, and search results faster than yt-dlp. The key is
          optional. If something goes wrong (key invalid, quota exhausted, etc.),
          Youtarr automatically falls back to yt-dlp with no loss of functionality.
        </Typography>
      </Alert>

      <Alert severity="info" className="mb-4">
        <AlertTitle>How to get a key</AlertTitle>
        <Typography variant="body2" component="div">
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              Sign in to the{' '}
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Google Cloud Console
              </a>{' '}
              with any Google account. Create a new project (or pick an existing one).
              No billing setup is required.
            </li>
            <li>
              Go to <b>APIs &amp; Services -&gt; Library</b>, search for{' '}
              <b>YouTube Data API v3</b>, and click <b>Enable</b>.
            </li>
            <li>
              Go to <b>APIs &amp; Services -&gt; Credentials</b>, click{' '}
              <b>Create credentials -&gt; API key</b>, and copy the value that
              appears.
            </li>
            <li>
              Click the pencil icon next to the new key, set{' '}
              <b>API restrictions</b> to <b>Restrict key</b> and select{' '}
              <b>YouTube Data API v3</b> only. Leave <b>Application restrictions</b>{' '}
              as <b>None</b> unless you know your Youtarr host IP.
            </li>
            <li>
              Paste the key below and click <b>Test Key</b>.
            </li>
          </ol>
          <Typography variant="caption" color="secondary" className="mt-2 block">
            Quota: 10,000 units per day, resets at midnight Pacific time. Search
            operations cost 100 units; everything else is 1 unit per call.
          </Typography>
        </Typography>
      </Alert>

      {(status === 'invalid' || status === 'api_not_enabled' || status === 'key_restricted') && lastReason && (
        <Alert severity="error" className="mb-4">{lastReason}</Alert>
      )}

      {status === 'quota_exhausted' && (
        <Alert severity="warning" className="mb-4">
          Today's quota is exhausted. Youtarr will transparently fall back to
          yt-dlp until the quota resets at midnight Pacific time.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box className="flex flex-col gap-2 md:flex-row md:items-start">
            <TextField
              fullWidth
              label="YouTube Data API Key"
              value={config.youtubeApiKey}
              onChange={handleInputChange}
              type="password"
              inputProps={{ 'data-testid': 'youtube-api-key-input', autoComplete: 'off' }}
            />
            <Button
              variant="contained"
              color={status === 'valid' ? 'success' : 'primary'}
              onClick={onTestKey}
              disabled={!hasKey || isTesting}
              className="h-10 min-w-[150px] whitespace-nowrap self-start md:pt-0.5"
              data-testid="test-youtube-key-button"
            >
              {isTesting ? 'Testing...' : 'Test Key'}
            </Button>
          </Box>
        </Grid>

        {lastValidatedAt && (
          <Grid item xs={12}>
            <Typography variant="caption" color="secondary">
              Last validated {lastValidatedAt.toLocaleString()}
            </Typography>
          </Grid>
        )}
      </Grid>
    </ConfigurationAccordion>
  );
};
