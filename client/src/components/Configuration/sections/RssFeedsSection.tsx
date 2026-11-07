import React, { ChangeEvent, useId, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
  TextField,
  Typography,
} from '../../ui';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { ConfigState, SnackbarState } from '../types';
import { useDownloadsFeedToken } from '../hooks/useDownloadsFeedToken';
import { getLinkTemplateError, LINK_TEMPLATE_VARIABLE } from '../../../config/notificationLinkTemplate';
import { locationUtils } from '../../../utils/location';

const ITEM_LIMIT_OPTIONS = [10, 25, 50, 100, 200];
const MEDIA_TYPE_OPTIONS = [
  { value: 'video', label: 'Videos' },
  { value: 'short', label: 'Shorts' },
  { value: 'livestream', label: 'Livestreams' },
];
const DOCS_URL = 'https://dialmasterorg.github.io/Youtarr/docs/usage-guide/#rss-feeds';

type LinkTarget = 'youtube' | 'youtarr' | 'custom';

interface RssFeedsSectionProps {
  token: string | null;
  config: ConfigState;
  savedConfig: ConfigState | null;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
}

export const RssFeedsSection: React.FC<RssFeedsSectionProps> = ({
  token,
  config,
  savedConfig,
  onConfigChange,
  setSnackbar,
}) => {
  const itemLimitLabelId = useId();
  const linkTargetLabelId = useId();
  const [customLinkChosen, setCustomLinkChosen] = useState(false);
  const [confirmingNewUrl, setConfirmingNewUrl] = useState(false);

  const enabled = config.downloadsFeedEnabled;
  const { feedToken, loading, error, regenerating, regenerate } = useDownloadsFeedToken(token, enabled);

  const origin = locationUtils.getOrigin();
  const feedUrl = feedToken ? `${origin}/feeds/downloads.xml?token=${encodeURIComponent(feedToken)}` : '';
  const youtarrTemplate = `${origin}/videos?video=${LINK_TEMPLATE_VARIABLE}`;

  const linkTemplate = config.downloadsFeedLinkTemplate;
  let linkTarget: LinkTarget = 'custom';
  if (!customLinkChosen && linkTemplate === '') linkTarget = 'youtube';
  if (!customLinkChosen && linkTemplate === youtarrTemplate) linkTarget = 'youtarr';
  const linkTemplateError = getLinkTemplateError(linkTemplate);

  const itemLimit = config.downloadsFeedItemLimit;
  const itemLimitOptions = [...new Set([...ITEM_LIMIT_OPTIONS, itemLimit])].sort((a, b) => a - b);
  const mediaTypes = config.downloadsFeedMediaTypes;

  const handleLinkTargetChange = (event: SelectChangeEvent) => {
    const target = event.target.value as LinkTarget;
    setCustomLinkChosen(target === 'custom');
    if (target === 'youtube') onConfigChange({ downloadsFeedLinkTemplate: '' });
    if (target === 'youtarr') onConfigChange({ downloadsFeedLinkTemplate: youtarrTemplate });
  };

  const toggleMediaType = (type: string, checked: boolean) => {
    const selected = new Set(mediaTypes);
    if (checked) selected.add(type);
    else selected.delete(type);
    // A fixed order, so unticking and re-ticking does not read as an unsaved change.
    onConfigChange({
      downloadsFeedMediaTypes: MEDIA_TYPE_OPTIONS.map((option) => option.value).filter((value) => selected.has(value)),
    });
  };

  const copyFeedUrl = async () => {
    try {
      // navigator.clipboard is undefined on plain http, except on localhost.
      await navigator.clipboard.writeText(feedUrl);
      setSnackbar({ open: true, message: 'Feed URL copied', severity: 'success' });
    } catch {
      setSnackbar({
        open: true,
        message: 'Your browser blocked copying. Select the URL and copy it yourself.',
        severity: 'warning',
      });
    }
  };

  const createNewUrl = async () => {
    setConfirmingNewUrl(false);
    const succeeded = await regenerate();
    setSnackbar(
      succeeded
        ? { open: true, message: 'Created a new feed URL. Update it in your RSS reader.', severity: 'success' }
        : { open: true, message: 'Could not create a new feed URL.', severity: 'error' }
    );
  };

  return (
    <ConfigurationCard
      title="Download Feed"
      subtitle="A private RSS feed of the videos Youtarr has downloaded, newest first. Add it to an RSS reader to see new videos without notifications."
    >
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onConfigChange({ downloadsFeedEnabled: event.target.checked })
            }
          />
        }
        label="Enable the download feed"
      />

      {enabled && (
        <Grid container spacing={3} className="mt-2">
          <Grid item xs={12}>
            {error && <Alert severity="error">{error}</Alert>}
            {!error && loading && (
              <Typography variant="body2" color="text.secondary">
                Loading the feed URL...
              </Typography>
            )}
            {!error && feedToken && (
              <Box className="flex flex-col gap-3">
                <TextField
                  fullWidth
                  label="Feed URL"
                  value={feedUrl}
                  InputProps={{ readOnly: true }}
                  inputProps={{ readOnly: true, onFocus: (event) => event.target.select() }}
                />
                <Box className="flex flex-wrap gap-2">
                  <Button variant="contained" onClick={copyFeedUrl}>
                    Copy URL
                  </Button>
                  <Button variant="outlined" disabled={regenerating} onClick={() => setConfirmingNewUrl(true)}>
                    Create new URL
                  </Button>
                </Box>
                {!savedConfig?.downloadsFeedEnabled && (
                  <Alert severity="info">This URL starts working after you save.</Alert>
                )}
              </Box>
            )}
          </Grid>

          <Grid item xs={12}>
            <Alert severity="warning">
              <Typography variant="body2">
                RSS readers can&apos;t log in, so this URL contains a secret. Anyone with it can see your video
                titles, descriptions and thumbnails (but not the video files), so treat it like a password.
              </Typography>
              <Typography variant="body2" className="mt-2">
                If you use a login proxy like Authelia or Cloudflare Access, add an exception for{' '}
                <code>/feeds/</code>.{' '}
                <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Read more
                </a>
              </Typography>
            </Alert>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id={itemLimitLabelId}>Videos in the feed</InputLabel>
              <Select
                labelId={itemLimitLabelId}
                label="Videos in the feed"
                value={itemLimit}
                onChange={(event: SelectChangeEvent) =>
                  onConfigChange({ downloadsFeedItemLimit: Number(event.target.value) })
                }
              >
                {itemLimitOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {`${option} videos`}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>The newest downloads are kept. RSS readers remember older ones they already saw.</FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id={linkTargetLabelId}>Clicking an item opens</InputLabel>
              <Select
                labelId={linkTargetLabelId}
                label="Clicking an item opens"
                value={linkTarget}
                onChange={handleLinkTargetChange}
              >
                <MenuItem value="youtube">YouTube</MenuItem>
                <MenuItem value="youtarr">This Youtarr</MenuItem>
                <MenuItem value="custom">A custom link</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {linkTarget === 'custom' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Custom link"
                value={linkTemplate}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onConfigChange({ downloadsFeedLinkTemplate: event.target.value })
                }
                placeholder="e.g., https://plex.example.com/search?id={youtubeId}"
                error={linkTemplateError !== null}
                helperText={linkTemplateError ?? 'Use {youtubeId} for the video ID. Leave empty to open YouTube.'}
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <Typography variant="subtitle2">Include</Typography>
            <Box className="flex flex-wrap gap-4">
              {MEDIA_TYPE_OPTIONS.map(({ value, label }) => {
                const checked = mediaTypes.includes(value);
                return (
                  <FormControlLabel
                    key={value}
                    control={
                      <Checkbox
                        checked={checked}
                        disabled={checked && mediaTypes.length === 1}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => toggleMediaType(value, event.target.checked)}
                      />
                    }
                    label={label}
                  />
                );
              })}
            </Box>
          </Grid>
        </Grid>
      )}

      <Dialog open={confirmingNewUrl} onClose={() => setConfirmingNewUrl(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create a new feed URL?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The current URL stops working right away. You&apos;ll need to add the new URL to your RSS reader.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmingNewUrl(false)}>Cancel</Button>
          <Button variant="contained" onClick={createNewUrl}>
            Replace URL
          </Button>
        </DialogActions>
      </Dialog>
    </ConfigurationCard>
  );
};

export default RssFeedsSection;
