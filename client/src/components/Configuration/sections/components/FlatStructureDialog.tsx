import React, { useEffect, useId, useState } from 'react';
import axios from 'axios';
import {
  Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '../../../ui';

interface AffectedChannels {
  count: number;
  channelNames: string[];
}

export interface FlatStructureDialogProps {
  open: boolean;
  /** The switch is being turned on (flat) or off (per-video folders) */
  turningOn: boolean;
  token: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirm a change of the global flat-structure default (Core 5). */
export function FlatStructureDialog({ open, turningOn, token, onConfirm, onCancel }: FlatStructureDialogProps) {
  const titleId = useId();
  const [affected, setAffected] = useState<AffectedChannels | null>(null);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setAffected(null);
    setShowList(false);
    axios.get<AffectedChannels>('/api/channels/using-global-file-structure', { headers: { 'x-access-token': token || '' } })
      .then((response) => { if (!cancelled) setAffected(response.data); })
      .catch(() => { if (!cancelled) setAffected(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, token]);

  return (
    <Dialog open={open} onClose={onCancel} aria-labelledby={titleId}>
      <DialogTitle id={titleId}>Change default file structure?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {turningOn
            ? 'New downloads for channels using the global setting will be saved directly in the channel folder (flat structure, no per-video subfolders).'
            : 'New downloads for channels using the global setting will be saved in individual per-video subfolders.'}
        </DialogContentText>
        <div className="my-4">
          {loading ? (
            <span className="flex items-center gap-2"><CircularProgress size={16} />Checking affected channels...</span>
          ) : affected === null ? (
            <DialogContentText className="text-warning">
              Could not determine how many channels are affected. You can still continue, but the affected channel count is unknown.
            </DialogContentText>
          ) : affected.count === 0 ? (
            <DialogContentText>No tracked channels are currently using the global setting.</DialogContentText>
          ) : (
            <>
              <DialogContentText>
                {affected.count} tracked channel{affected.count !== 1 ? 's' : ''} follow{affected.count === 1 ? 's' : ''} the global setting and will be affected.
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
        <DialogContentText>Channels in TV shows folders aren&apos;t affected: their episodes always go straight into Season folders.</DialogContentText>
        <DialogContentText className="mt-2">
          Previously downloaded videos are not affected. Existing files will not be moved or renamed; only new downloads use the new structure.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm} disabled={loading}>Confirm</Button>
      </DialogActions>
    </Dialog>
  );
}
