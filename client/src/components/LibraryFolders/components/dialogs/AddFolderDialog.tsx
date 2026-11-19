import React, { useEffect, useId, useState } from 'react';
import { Check, RefreshCw } from '../../../../lib/icons';
import { Button, CircularProgress, Dialog, DialogActions, DialogTitle } from '../../../ui';
import { cn } from '../../../../lib/cn';
import type { CreateLibraryFolderResult, LibraryLayout } from '../../../../types/tvShows';
import type { ReorganizeChange } from '../../../../types/reorganize';
import { useLibraryCheck } from '../../../../hooks/useLibraryCheck';
import { isReorganizeRequired } from '../../../shared/Reorganize';
import { checkStatus } from '../../../../utils/libraryAttention';
import { useNow } from '../../../Configuration/hooks/useNow';
import { useLibraryPage } from '../../LibraryFoldersContext';
import { useCreateLibraryFolder } from '../../hooks/useCreateLibraryFolder';
import { checkStatusText } from '../../mediaServerText';
import { AddFolderNameStep, folderNameError } from './AddFolderNameStep';
import { AddFolderServersStep } from './AddFolderServersStep';

export interface AddFolderDialogProps {
  open: boolean;
  initialLayout: LibraryLayout;
  onClose: () => void;
  /** The folder exists: select it */
  onCreated: (name: string) => void;
  /** A directory with files asked for TV: close and open Review the move */
  onNeedsReview: (change: ReorganizeChange, name: string) => void;
}

/** Add library folder: name and layout, then media servers (UI 7.1). */
export function AddFolderDialog({ open, initialLayout, onClose, onCreated, onNeedsReview }: AddFolderDialogProps) {
  const page = useLibraryPage();
  const titleId = useId();
  const now = useNow();
  const { creating, createFolder } = useCreateLibraryFolder(page.token);
  const [name, setName] = useState('');
  const [layout, setLayout] = useState<LibraryLayout>(initialLayout);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateLibraryFolderResult | null>(null);
  const check = useLibraryCheck(page.token, { folders: created ? [created.name] : [], enabled: Boolean(created) && page.servers.length > 0 });

  useEffect(() => {
    if (!open) return;
    setName('');
    setLayout(initialLayout);
    setServerError(null);
    setCreated(null);
  }, [open, initialLayout]);

  const ruleError = folderNameError(name, page.folders.map((folder) => folder.name));
  const nameError = serverError ?? ruleError;
  const valid = name.trim() !== '' && ruleError === null;
  const close = () => { if (!creating) onClose(); };

  const submit = async () => {
    if (!valid) return;
    setServerError(null);
    try {
      const result = await createFolder(name.trim(), layout);
      onCreated(result.name);
      setCreated(result);
    } catch (err: unknown) {
      if (isReorganizeRequired(err)) {
        onNeedsReview(err.change, name.trim());
        return;
      }
      setServerError(err instanceof Error && err.message ? err.message : 'Failed to create the folder');
    }
  };

  const status = checkStatus(check, page.configuredServers);
  const stepClass = (active: boolean) => cn('flex items-center gap-1.5 text-[13px]', active && 'font-semibold');
  const circle = (step: number, done: boolean, active: boolean) => (
    <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs',
      done ? 'border-primary bg-primary text-primary-foreground' : active ? 'border-primary' : 'border-border')}>
      {done ? <Check size={12} aria-hidden="true" /> : step}
    </span>
  );
  const full = page.phone ? 'min-h-[44px] w-full' : undefined;

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth fullScreen={page.phone} aria-labelledby={titleId}>
      <DialogTitle id={titleId} onClose={close}>Add library folder</DialogTitle>
      <ol className="flex items-center gap-3 border-b border-border px-5 py-2.5">
        <li aria-current={created ? undefined : 'step'} className={stepClass(!created)}>{circle(1, Boolean(created), !created)}Name and layout</li>
        <li aria-hidden="true" className="h-px flex-1 bg-border" />
        <li aria-current={created ? 'step' : undefined} className={stepClass(Boolean(created))}>{circle(2, false, Boolean(created))}Media servers</li>
      </ol>
      {created ? (
        <AddFolderServersStep name={created.name} layout={created.layout} existingContent={Boolean(created.existingContent)} check={check} onClose={onClose} />
      ) : (
        <AddFolderNameStep name={name} layout={layout} error={nameError}
          onNameChange={(next) => { setName(next); setServerError(null); }} onLayoutChange={setLayout} />
      )}
      <DialogActions className={cn('border-t border-border px-5 py-3', page.phone && 'flex-col gap-2')}>
        {created ? (
          <>
            {page.servers.length > 0 && (
              <>
                <Button variant="outlined" disabled={check.loading} onClick={() => { void check.refetch(); }} className={full}
                  startIcon={check.loading ? <CircularProgress size={14} /> : <RefreshCw size={14} />}>
                  {check.loading ? 'Checking...' : 'Check now'}
                </Button>
                <span className={cn('text-xs text-muted-foreground', page.phone && 'text-center')}>
                  {checkStatusText(status, page.servers, now, page.timeZone)}
                </span>
              </>
            )}
            {!page.phone && <span className="flex-1" />}
            {page.phone ? (
              <>
                <Button variant="contained" onClick={onClose} className={full}>Done</Button>
                <Button variant="text" onClick={onClose} className={full}>Finish later</Button>
              </>
            ) : (
              <>
                <Button variant="text" onClick={onClose}>Finish later</Button>
                <Button variant="contained" onClick={onClose}>Done</Button>
              </>
            )}
          </>
        ) : (
          <div className={cn('flex gap-2', page.phone && 'w-full flex-col-reverse')}>
            <Button variant="text" onClick={close} disabled={creating} className={full}>Cancel</Button>
            <Button variant="contained" disabled={!valid || creating} onClick={() => { void submit(); }} className={full}
              startIcon={creating ? <CircularProgress size={14} /> : undefined}>
              Create __{name.trim() || 'Name'}
            </Button>
          </div>
        )}
      </DialogActions>
    </Dialog>
  );
}
