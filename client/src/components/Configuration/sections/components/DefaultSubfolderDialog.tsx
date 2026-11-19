import React, { useEffect, useId, useState } from 'react';
import axios from 'axios';
import {
  Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '../../../ui';

interface AffectedChannels {
  count: number;
  channelNames: string[];
}

const NO_CHANNELS: AffectedChannels = { count: 0, channelNames: [] };

export interface DefaultSubfolderDialogProps {
  open: boolean;
  /** The subfolder about to become the default (clean name, no __ prefix); null or empty is the root directory */
  subfolder: string | null;
  /** The subfolder was just created with Add Subfolder, so declining keeps it and only skips the default */
  isNew: boolean;
  token: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirm a change of the default subfolder, naming the channels that follow it. */
export function DefaultSubfolderDialog({ open, subfolder, isNew, token, onConfirm, onCancel }: DefaultSubfolderDialogProps) {
  const titleId = useId();
  const [affected, setAffected] = useState<AffectedChannels>(NO_CHANNELS);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setAffected(NO_CHANNELS);
    setShowList(false);
    axios.get<AffectedChannels>('/api/channels/using-default-subfolder', { headers: { 'x-access-token': token || '' } })
      .then((response) => { if (!cancelled) setAffected(response.data); })
      .catch(() => { if (!cancelled) setAffected(NO_CHANNELS); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, token]);

  return (
    <Dialog open={open} onClose={onCancel} aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{isNew ? 'Set New Subfolder as Default?' : 'Set Default Subfolder?'}</DialogTitle>
      <DialogContent>
        {isNew && (
          <DialogContentText className="mb-2">
            Subfolder <strong>{`__${subfolder}`}</strong> has been created and is available anywhere subfolders can be selected.
          </DialogContentText>
        )}
        <DialogContentText>
          {isNew
            ? 'Would you also like to make it the default subfolder? This will affect where videos are downloaded for:'
            : 'Setting a default subfolder will affect where videos are downloaded for:'}
        </DialogContentText>
        <ul className="mt-2 list-disc pl-6 text-sm">
          <li>Untracked channels (manual URL downloads)</li>
          <li>Channels configured to use &quot;Default Subfolder&quot;</li>
        </ul>
        <div className="my-4">
          {loading ? (
            <span className="flex items-center gap-2"><CircularProgress size={16} />Checking affected channels...</span>
          ) : affected.count === 0 ? (
            <DialogContentText>No tracked channels are currently using Default Subfolder.</DialogContentText>
          ) : (
            <>
              <DialogContentText>
                {affected.count} tracked channel{affected.count !== 1 ? 's' : ''} configured to use Default Subfolder.
              </DialogContentText>
              <button type="button" onClick={() => setShowList((shown) => !shown)}
                className="mt-1 text-sm text-primary underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
                {showList ? 'Hide affected channels' : 'Show affected channels'}
              </button>
              {showList && (
                <ul className="mt-2 max-h-[200px] overflow-auto rounded bg-muted/50 py-2 pl-6 text-sm">
                  {affected.channelNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
        <DialogContentText>
          Videos will be downloaded to channel folders in: <strong>{subfolder ? `__${subfolder}` : 'the root directory'}</strong>
        </DialogContentText>
        <DialogContentText className="mt-2 italic">Existing videos will not be moved.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{isNew ? "Don't Set as Default" : 'Cancel'}</Button>
        <Button variant="contained" onClick={onConfirm}>Set as Default</Button>
      </DialogActions>
    </Dialog>
  );
}
