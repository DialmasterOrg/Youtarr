import React, { useCallback, useState } from 'react';
import {
  TextField,
  FormHelperText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  AlertTitle,
  Typography,
  Button,
  Box,
} from '../../ui';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState } from '../types';
import { validateProxyUrl } from '../utils/configValidation';
import { useYtdlpArgsValidation } from '../hooks/useYtdlpArgsValidation';
import {
  MAX_CUSTOM_ARGS_LENGTH,
  getBlockedFlagInArgs,
  getPositionalTokenInArgs,
  validateRateLimit,
} from './ytdlpOptionsHelpers';

interface YtdlpOptionsSectionProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
  token: string | null;
}

export const YtdlpOptionsSection: React.FC<YtdlpOptionsSectionProps> = ({
  config,
  onConfigChange,
  onMobileTooltipClick,
  token,
}) => {
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const handleProxyChange = useCallback((value: string) => {
    onConfigChange({ proxy: value });
    setProxyError(null);
  }, [onConfigChange]);

  const handleProxyBlur = useCallback(() => {
    setProxyError(validateProxyUrl(config.proxy || ''));
  }, [config.proxy]);

  const handleRateLimitBlur = useCallback(() => {
    setRateLimitError(validateRateLimit(config.ytdlpDownloadRateLimit));
  }, [config.ytdlpDownloadRateLimit]);

  const customArgs = config.ytdlpCustomArgs || '';
  const blockedFlag = getBlockedFlagInArgs(customArgs);
  const positionalToken = getPositionalTokenInArgs(customArgs);
  const tooLong = customArgs.length > MAX_CUSTOM_ARGS_LENGTH;

  let customArgsError: string | null = null;
  if (blockedFlag) {
    customArgsError = `${blockedFlag} is not allowed in custom args. Use the dedicated setting field instead.`;
  } else if (positionalToken) {
    customArgsError = `"${positionalToken}" looks like a positional argument. Custom args must be yt-dlp flags (start with -). Quote values that contain spaces.`;
  } else if (tooLong) {
    customArgsError = `Custom arguments exceed the ${MAX_CUSTOM_ARGS_LENGTH}-character limit.`;
  }

  const { validating, result, validate, reset } = useYtdlpArgsValidation(token);

  const handleValidate = useCallback(async () => {
    await validate(customArgs);
  }, [validate, customArgs]);

  const handleCustomArgsChange = useCallback(
    (value: string) => {
      onConfigChange({ ytdlpCustomArgs: value });
      reset();
    },
    [onConfigChange, reset]
  );

  return (
    <ConfigurationAccordion
      title='yt-dlp Options'
      chipLabel='Advanced'
      chipColor='default'
      defaultExpanded={false}
    >
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label='Sleep Between Requests (seconds)'
            type='number'
            inputProps={{ min: 0, max: 30, step: 1 }}
            value={config.sleepRequests ?? 1}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value >= 0 && value <= 30) onConfigChange({ sleepRequests: value });
            }}
            helperText={
              <span style={{ display: 'flex', alignItems: 'center' }}>
                Delay between yt-dlp API requests (0-30). Higher values prevent YouTube rate limiting but slow downloads.
                <InfoTooltip
                  text='A delay of 1-2 seconds usually works well. Increase to 5-10 seconds if you experience 429 errors or frequent throttling.'
                  onMobileClick={onMobileTooltipClick}
                />
              </span>
            }
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label='Proxy URL'
            type='text'
            value={config.proxy || ''}
            onChange={(e) => handleProxyChange(e.target.value)}
            onBlur={handleProxyBlur}
            error={Boolean(proxyError)}
            helperText={proxyError || 'Optional proxy URL (e.g., socks5://user:pass@127.0.0.1:1080/). Leave empty for direct connection.'}
          />
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel id='ytdlp-ip-family-label'>IP Family</InputLabel>
            <Select
              labelId='ytdlp-ip-family-label'
              label='IP Family'
              value={config.ytdlpIpFamily || 'ipv4'}
              onChange={(e) => onConfigChange({ ytdlpIpFamily: e.target.value as 'ipv4' | 'ipv6' | 'auto' })}
              inputProps={{ 'aria-label': 'IP Family' }}
            >
              <MenuItem value='ipv4'>Force IPv4</MenuItem>
              <MenuItem value='ipv6'>Force IPv6</MenuItem>
              <MenuItem value='auto'>Auto</MenuItem>
            </Select>
            <FormHelperText>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                IPv4 is recommended for YouTube reliability.
                <InfoTooltip
                  text='Force IPv6 or Auto only if your network requires it. Downloads may become unreliable on networks where YouTube responds slowly to IPv6.'
                  onMobileClick={onMobileTooltipClick}
                />
              </span>
            </FormHelperText>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label='Download Rate Limit'
            type='text'
            placeholder='e.g. 5M'
            value={config.ytdlpDownloadRateLimit || ''}
            onChange={(e) => {
              onConfigChange({ ytdlpDownloadRateLimit: e.target.value });
              setRateLimitError(null);
            }}
            onBlur={handleRateLimitBlur}
            error={Boolean(rateLimitError)}
            helperText={rateLimitError || 'Examples: 500K, 5M, 1G. Leave empty for no limit.'}
          />
        </Grid>

        <Grid item xs={12}>
          <Alert severity='warning' style={{ marginBottom: 8 }}>
            <AlertTitle>Power user feature</AlertTitle>
            <Typography variant='body2'>
              Custom arguments are applied to every yt-dlp call. Incorrect flags can prevent downloads from working entirely or break Youtarr&apos;s behavior in unexpected ways. Use at your own risk; remove the args if you encounter problems.
            </Typography>
          </Alert>

          <TextField
            fullWidth
            multiline
            minRows={4}
            label='Custom yt-dlp Arguments'
            placeholder='--concurrent-fragments 4 --retries 5'
            value={customArgs}
            onChange={(e) => handleCustomArgsChange(e.target.value)}
            error={Boolean(customArgsError)}
            helperText={
              customArgsError ||
              'Space-separated yt-dlp flags. Example: --concurrent-fragments 4 --retries 5 --no-mtime. Quote values that contain spaces.'
            }
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />

          <Box style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              variant='outlined'
              onClick={handleValidate}
              disabled={!customArgs.trim() || validating || Boolean(customArgsError)}
            >
              {validating ? 'Validating...' : 'Validate Arguments'}
            </Button>
            {result?.ok === true && (
              <Typography variant='body2' color='success'>
                {result.message || 'Arguments parsed successfully'}
              </Typography>
            )}
          </Box>

          {result?.ok === false && (
            <Alert severity='error' style={{ marginTop: 8 }}>
              <AlertTitle>yt-dlp rejected the arguments</AlertTitle>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {result.stderr}
              </pre>
            </Alert>
          )}
        </Grid>
      </Grid>
    </ConfigurationAccordion>
  );
};
