import React, { useId, useState } from 'react';
import { Warning } from '../../../../lib/icons';
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '../../../ui';
import { cn } from '../../../../lib/cn';
import type { LibraryFolder } from '../../../../types/tvShows';
import { isReorganizeRequired } from '../../../shared/Reorganize';
import { useLibraryPage } from '../../LibraryFoldersContext';
import { useDefaultFolder } from '../../hooks/useDefaultFolder';
import { makeDefaultText } from '../../folderText';

/** Make default confirm (UI 7.3). */
export function MakeDefaultDialog({ folder, onClose }: { folder: LibraryFolder; onClose: () => void }) {
  const page = useLibraryPage();
  const titleId = useId();
  const { saving, setDefaultFolder } = useDefaultFolder(page.token);
  const [error, setError] = useState<string | null>(null);
  const current = page.folders.find((entry) => entry.isDefault) ?? null;
  const text = makeDefaultText({ folder, current });

  const confirm = async () => {
    setError(null);
    try {
      await setDefaultFolder(folder.name);
      onClose();
    } catch (err: unknown) {
      if (isReorganizeRequired(err)) {
        onClose();
        page.reviewChange(err.change, { kind: 'default', folder: folder.name });
        return;
      }
      setError(err instanceof Error && err.message ? err.message : 'Failed to change the default folder');
    }
  };
  const full = page.phone ? 'min-h-[44px] w-full' : undefined;

  return (
    <Dialog open maxWidth="sm" fullWidth onClose={() => { if (!saving) onClose(); }} aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{text.title}</DialogTitle>
      <DialogContent className="flex flex-col gap-3 text-[13px]">
        <p>{text.body}</p>
        {text.sameLayoutNote && <p className="text-muted-foreground">{text.sameLayoutNote}</p>}
        {text.warning && (
          <p className="flex items-start gap-1.5 rounded-ui border border-warning p-2">
            <Warning size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />{text.warning}
          </p>
        )}
        {text.tvLine && <p>{text.tvLine}</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
      </DialogContent>
      <DialogActions className={cn(page.phone && 'flex-col-reverse gap-2')}>
        <Button variant="text" onClick={onClose} disabled={saving} className={full}>Cancel</Button>
        <Button variant="contained" onClick={() => { void confirm(); }} disabled={saving} className={full}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}>
          {text.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
