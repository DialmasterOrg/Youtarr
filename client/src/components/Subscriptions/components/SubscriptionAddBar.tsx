import React from 'react';
import { Button, CircularProgress, Grid, TextField } from '../../ui';
import { Add as AddIcon, Upload as UploadIcon } from '../../../lib/icons';
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
  channels: { label: 'Add a new channel', placeholder: 'Paste a channel URL or @handle' },
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
  const { label, placeholder } = MODE_COPY[mode];

  const submit = () => {
    if (isEmpty) return;
    if (isChannels) {
      if (!isAddingChannel) onAddChannel();
    } else {
      onAddPlaylist();
    }
  };

  return (
    <Grid container spacing={2} alignItems="center" className="mb-2 md:mb-4">
      <Grid item xs={12} md={8}>
        <TextField
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
          disabled={isChannels && isAddingChannel}
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
                  disabled={isAddingChannel || isEmpty}
                >
                  {isAddingChannel ? 'Adding…' : 'Channel'}
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
    </Grid>
  );
};

export default SubscriptionAddBar;
