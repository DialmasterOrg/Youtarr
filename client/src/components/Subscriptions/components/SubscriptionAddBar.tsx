import React, { useRef } from 'react';
import { Button, CircularProgress, Grid, TextField, Typography } from '../../ui';
import { Add as AddIcon, Clear as ClearIcon, Upload as UploadIcon } from '../../../lib/icons';
import { isExplicitChannelReference, normalizeChannelUrl } from '../../../utils/channelHelpers';
import { SubscriptionsFilterValue } from './SubscriptionsFilter';

interface SubscriptionAddBarProps {
  mode: SubscriptionsFilterValue;
  url: string;
  onUrlChange: (value: string) => void;
  onAddChannel: () => void;
  onAddPlaylist: () => void;
  onImport: () => void;
  isAddingChannel: boolean;
}

const MODE_COPY: Record<SubscriptionsFilterValue, { label: string; placeholder: string }> = {
  channels: { label: 'Search or add a channel', placeholder: 'Paste a channel URL or @handle' },
  playlists: { label: 'Add a new playlist', placeholder: 'Paste a playlist URL' },
};

const SubscriptionAddBar: React.FC<SubscriptionAddBarProps> = ({
  mode,
  url,
  onUrlChange,
  onAddChannel,
  onAddPlaylist,
  onImport,
  isAddingChannel,
}) => {
  const isChannels = mode === 'channels';
  const isEmpty = !url.trim();
  const isLookingUp = isChannels && isAddingChannel;
  const canAddChannel = !isAddingChannel && normalizeChannelUrl(url) !== null;
  const { label, placeholder } = MODE_COPY[mode];
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    onUrlChange('');
    inputRef.current?.focus();
  };

  const submit = () => {
    if (isEmpty) return;
    if (!isChannels) {
      onAddPlaylist();
      return;
    }
    // The channel input also searches the list, so Enter adds only what is
    // plainly a channel; a bare word needs the Channel button.
    if (canAddChannel && isExplicitChannelReference(url)) onAddChannel();
  };

  return (
    <Grid container spacing={2} alignItems="center" className="mb-2 md:mb-4">
      <Grid item xs={12} md={8}>
        <TextField
          ref={inputRef}
          spellCheck={false}
          fullWidth
          size="small"
          label={label}
          placeholder={placeholder}
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          disabled={isLookingUp}
          InputProps={{
            endAdornment: !isEmpty && !isLookingUp ? (
              <button
                type="button"
                aria-label="Clear"
                onClick={clear}
                className="inline-flex cursor-pointer items-center border-0 bg-transparent p-0.5 text-muted-foreground hover:text-foreground"
              >
                <ClearIcon size={16} />
              </button>
            ) : undefined,
          }}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <Grid container spacing={1.5}>
          {isChannels ? (
            <>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={isAddingChannel ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                  onClick={onAddChannel}
                  disabled={!canAddChannel}
                >
                  {isAddingChannel ? 'Looking up...' : 'Channel'}
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={onImport}
                >
                  Import
                </Button>
              </Grid>
            </>
          ) : (
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAddPlaylist}
                disabled={isEmpty}
              >
                Playlist
              </Button>
            </Grid>
          )}
        </Grid>
      </Grid>
      {isChannels && isAddingChannel && (
        <Grid item xs={12}>
          <div role="status" className="flex items-center gap-2">
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Looking up channel on YouTube... this can take a few seconds.
            </Typography>
          </div>
        </Grid>
      )}
    </Grid>
  );
};

export default SubscriptionAddBar;
