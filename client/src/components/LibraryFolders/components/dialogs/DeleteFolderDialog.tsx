import React, { useId, useState } from 'react';
import { Trash2 } from '../../../../lib/icons';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '../../../ui';
import type { LibraryFolder } from '../../../../types/tvShows';
import { useSubfolders } from '../../../../hooks/useSubfolders';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../../hooks/useLibraryFolders';
import { useLibraryPage } from '../../LibraryFoldersContext';
import { folderLabel } from '../../folderText';

export interface DeleteFolderDialogProps {
  folder: LibraryFolder;
  onClose: () => void;
  onDeleted: (folder: LibraryFolder) => void;
}

/** Delete confirm (UI 7.4). Mounted only while open, so useSubfolders loads only then. */
export function DeleteFolderDialog({ folder, onClose, onDeleted }: DeleteFolderDialogProps) {
  const { token, phone } = useLibraryPage();
  const { deleteSubfolder } = useSubfolders(token);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = folderLabel(folder.name);
  const mapped = Boolean(folder.plexMapping && folder.plexMapping.choice !== 'none');

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteSubfolder(folder.name);
      window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT));
      onDeleted(folder);
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to delete the folder');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open maxWidth="xs" fullWidth onClose={() => { if (!busy) onClose(); }} aria-labelledby={titleId}>
      <DialogTitle id={titleId}>Delete {label}?</DialogTitle>
      <DialogContent>
        <p className="text-[13px]">
          It&apos;s empty and nothing downloads to it. Youtarr removes it from this list and deletes the empty folder from disk.
          {mapped ? ' Its Plex refresh setting is removed too.' : ''}
        </p>
        {error && <p role="alert" className="mt-3 text-[13px] text-destructive">{error}</p>}
      </DialogContent>
      <DialogActions className={phone ? 'flex-col-reverse gap-2' : undefined}>
        <Button variant="text" onClick={onClose} disabled={busy} className={phone ? 'min-h-[44px] w-full' : undefined}>Cancel</Button>
        <Button variant="outlined" color="error" onClick={() => { void confirm(); }} disabled={busy || error !== null}
          startIcon={busy ? <CircularProgress size={14} /> : <Trash2 size={14} aria-hidden="true" />}
          className={phone ? 'min-h-[44px] w-full' : undefined}>
          Delete folder
        </Button>
      </DialogActions>
    </Dialog>
  );
}
