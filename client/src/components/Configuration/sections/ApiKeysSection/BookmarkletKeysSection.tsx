import React from 'react';
import { Box, Button, Chip, IconButton, Paper, TextField, Tooltip, Typography } from '../../../ui';
import { Plus as AddIcon, Trash2 as DeleteIcon } from 'lucide-react';
import { InfoTooltip } from '../../common/InfoTooltip';
import { formatKeyDate } from './ExternalKeyCard';
import { ApiKey } from './useApiKeys';

const MIN_RATE_LIMIT = 1;
const MAX_RATE_LIMIT = 100;

interface BookmarkletKeysSectionProps {
  keys: ApiKey[];
  rateLimit: number;
  onRateLimitChange: (value: number) => void;
  onCreate: () => void;
  onRevoke: (id: number, name: string) => void;
}

export default function BookmarkletKeysSection({
  keys,
  rateLimit,
  onRateLimitChange,
  onCreate,
  onRevoke,
}: BookmarkletKeysSectionProps) {
  return (
    <>
      <Box className="mb-6">
        <Typography variant="subtitle1" gutterBottom>
          Get the "Send to Youtarr" button
        </Typography>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            Click <strong>Create Key</strong>, give it a name like "Laptop browser", and click <strong>Create</strong>.
          </li>
          <li>In the window that opens, drag the <strong>Send to Youtarr</strong> button to your bookmarks bar.</li>
          <li>On any YouTube video, click the button to queue it.</li>
        </ol>
        <Typography variant="body2" color="secondary" className="mt-2">
          The button is only shown once. If you lose it, create another key.
        </Typography>
      </Box>

      <Typography variant="body2" color="secondary" className="mb-4">
        Keys also work with Apple Shortcuts, Tasker, and other tools.
        <strong> Note:</strong> API keys currently support single video downloads only. Playlists and channels require the web UI.
      </Typography>

      <Box className="flex justify-between items-center mb-4">
        <Typography variant="subtitle1">Manage API Keys</Typography>
        <Button variant="contained" startIcon={<AddIcon size={16} />} onClick={onCreate} size="small">
          Create Key
        </Button>
      </Box>

      {keys.length === 0 ? (
        <Paper className="p-6 text-center">
          <Typography color="secondary">No API keys yet. Create one to get your Send to Youtarr button.</Typography>
        </Paper>
      ) : (
        <div className="grid gap-2" aria-label="Bookmarklet API key rows">
          {keys.map((key) => (
            <Paper
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-border p-3 shadow-none"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Typography variant="subtitle2" className="truncate">
                    {key.name}
                  </Typography>
                  <Chip label={`${key.key_prefix}...`} size="small" variant="outlined" />
                  {key.revoked_at && <Chip label="Revoked" size="small" color="error" variant="outlined" />}
                  <Chip
                    label={`${key.usage_count} ${key.usage_count === 1 ? 'use' : 'uses'}`}
                    size="small"
                    variant="outlined"
                  />
                </div>
                <Typography variant="caption" color="secondary">
                  Created {formatKeyDate(key.created_at)} · Last used {formatKeyDate(key.last_used_at)}
                </Typography>
              </div>
              {!key.revoked_at && (
                <Tooltip title="Revoke">
                  <IconButton
                    size="small"
                    onClick={() => onRevoke(key.id, key.name)}
                    color="error"
                    aria-label={`Revoke ${key.name}`}
                  >
                    <DeleteIcon size={16} />
                  </IconButton>
                </Tooltip>
              )}
            </Paper>
          ))}
        </div>
      )}

      <Box className="mt-6 flex items-center">
        <TextField
          type="number"
          label="Rate Limit (requests/min)"
          value={rateLimit}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= MIN_RATE_LIMIT && val <= MAX_RATE_LIMIT) {
              onRateLimitChange(val);
            }
          }}
          inputProps={{ min: MIN_RATE_LIMIT, max: MAX_RATE_LIMIT }}
          size="small"
          className="w-[200px]"
        />
        <InfoTooltip text="Maximum download requests per minute per API key. Helps prevent abuse." />
      </Box>
    </>
  );
}
