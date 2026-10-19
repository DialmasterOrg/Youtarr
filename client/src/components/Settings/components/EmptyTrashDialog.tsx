import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '../../ui';
import { Checkbox, FormControlLabel, RadioGroup, RadioGroupItem } from '../../ui/form';
import { Trash2 as TrashIcon } from '../../../lib/icons';
import type { EmptyTrashOptions, TrashState } from '../hooks/useRemovedVideos';

type WhichChoice = TrashState | 'both';
type ArchiveChoice = 'keep' | 'remove';

interface EmptyTrashDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: EmptyTrashOptions) => void;
  counts: { deleted: number; missing: number };
  // Why the missing choices are unavailable (the downloads folder looks unmounted), or null.
  missingDisabledReason: string | null;
  // Why archive entries cannot be removed right now (a download is running), or null.
  archiveRemovalDisabledReason: string | null;
  pending: boolean;
}

// The first choice that is both available and non-empty, so the dialog never
// opens on a choice the user cannot confirm.
function defaultChoice(counts: { deleted: number; missing: number }, missingDisabled: boolean): WhichChoice {
  return counts.deleted === 0 && !missingDisabled ? 'missing' : 'deleted';
}

const STATES_FOR: Record<WhichChoice, TrashState[]> = {
  deleted: ['deleted'],
  missing: ['missing'],
  both: ['deleted', 'missing'],
};

const videos = (n: number) => (n === 1 ? 'video' : 'videos');

interface ChoiceProps {
  id: string;
  value: string;
  label: string;
  help: string;
  disabled?: boolean;
}

// One radio with its label and a line of help beneath; the help stays out of
// the label so the radio's accessible name is just the choice.
function Choice({ id, value, label, help, disabled = false }: ChoiceProps) {
  return (
    <div className="flex items-start gap-2">
      <RadioGroupItem id={id} value={value} disabled={disabled} className="mt-1 shrink-0" />
      <div className="min-w-0">
        <label htmlFor={id} className={`text-sm font-medium ${disabled ? 'text-muted-foreground' : 'cursor-pointer'}`}>
          {label}
        </label>
        <Typography component="p" variant="caption" color="text.secondary">
          {help}
        </Typography>
      </div>
    </div>
  );
}

// Confirms a purge: which videos, what happens to the download archive, what
// it does, and that it cannot be undone.
const EmptyTrashDialog: React.FC<EmptyTrashDialogProps> = ({
  open,
  onClose,
  onConfirm,
  counts,
  missingDisabledReason,
  archiveRemovalDisabledReason,
  pending,
}) => {
  const id = useId();
  const missingDisabled = missingDisabledReason !== null || counts.missing === 0;
  const [which, setWhich] = useState<WhichChoice>(() => defaultChoice(counts, missingDisabled));
  const [archive, setArchive] = useState<ArchiveChoice>('keep');
  const [acknowledged, setAcknowledged] = useState(false);

  // Every opening starts from the safe defaults. Only an opening resets, from
  // the counts current at that moment: the ref is refreshed after each render
  // (never during one), so a parent re-render cannot wipe the user's choices.
  const openingChoice = useRef(which);
  useEffect(() => {
    openingChoice.current = defaultChoice(counts, missingDisabled);
  });
  useEffect(() => {
    if (open) {
      setWhich(openingChoice.current);
      setArchive('keep');
      setAcknowledged(false);
    }
  }, [open]);

  // Archive removal is refused while a download runs; the choice falls back to keep.
  const archiveRemovalDisabled = archiveRemovalDisabledReason !== null;
  const effectiveArchive: ArchiveChoice = archiveRemovalDisabled ? 'keep' : archive;
  const total = counts.deleted + counts.missing;
  const count = which === 'deleted' ? counts.deleted : which === 'missing' ? counts.missing : total;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <TrashIcon size={20} className="shrink-0" />
        Empty trash
      </DialogTitle>

      <DialogContent>
        <div className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold mb-2">Which videos</legend>
            <RadioGroup value={which} onValueChange={(value) => setWhich(value as WhichChoice)} className="space-y-3">
              <Choice
                id={`${id}-deleted`}
                value="deleted"
                label={`Deleted (${counts.deleted})`}
                help="Removed by Youtarr or marked as deleted."
              />
              <Choice
                id={`${id}-missing`}
                value="missing"
                label={`Missing (${counts.missing})`}
                help={missingDisabledReason ?? 'Expected on disk but not found.'}
                disabled={missingDisabled}
              />
              <Choice
                id={`${id}-both`}
                value="both"
                label={`Both (${total})`}
                help="Every video whose file is gone."
                disabled={missingDisabled}
              />
            </RadioGroup>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold mb-2">Download archive</legend>
            <RadioGroup value={effectiveArchive} onValueChange={(value) => setArchive(value as ArchiveChoice)} className="space-y-3">
              <Choice
                id={`${id}-keep`}
                value="keep"
                label="Keep them in the download archive (recommended)"
                help="Automatic channel and playlist downloads keep skipping them, as they do now."
              />
              <Choice
                id={`${id}-remove`}
                value="remove"
                label="Remove them from the download archive"
                help={archiveRemovalDisabledReason ?? 'Automatic downloads treat them as new and may download them again at the next run.'}
                disabled={archiveRemovalDisabled}
              />
            </RadioGroup>
          </fieldset>

          <div>
            <Typography variant="body2" className="font-semibold mb-1">
              What happens
            </Typography>
            <ul className="list-disc pl-5 space-y-1">
              <Typography component="li" variant="body2" color="text.secondary">
                They disappear from the Videos page and from Download History.
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Their channel and playlist pages show them as not downloaded.
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Watch history Youtarr synced for them from your media servers is removed.
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                No files in your downloads folder are touched. If a missing video&apos;s file turns up later, Youtarr will not know about it; download it again instead.
              </Typography>
            </ul>
          </div>

          <Alert severity="error">This cannot be undone.</Alert>

          <FormControlLabel
            control={<Checkbox checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />}
            label="I understand this cannot be undone"
          />
        </div>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary" autoFocus>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm({ states: STATES_FOR[which], removeFromArchive: effectiveArchive === 'remove' })}
          variant="outlined"
          color="error"
          disabled={!acknowledged || count === 0 || pending}
        >
          Empty trash ({count} {videos(count)})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmptyTrashDialog;
