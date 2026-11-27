import React, { useEffect, useState } from 'react';
import { Alert, Typography } from '../../ui';
import { Checkbox, FormControlLabel } from '../../ui/form';
import ConfirmDialog from '../../shared/ConfirmDialog';

interface RescanAnywayDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  // Why the rescan is holding back: the library check's message, or null when
  // it is the last rescan that could not find most videos.
  folderMessage: string | null;
  // Downloaded videos the rescan would mark missing (exactly, or at most).
  affected: number;
  // Downloaded videos on record as present, the whole library the count is out of.
  present: number;
  // True when every affected video will be marked missing (an empty folder);
  // false when only those the rescan cannot find will be.
  exact: boolean;
}

const formatCount = (n: number) => n.toLocaleString('en-US');

function describeAffected(affected: number, present: number, exact: boolean): string {
  if (exact) {
    return `${formatCount(affected)} of your ${formatCount(present)} downloaded ${present === 1 ? 'video' : 'videos'} will be marked missing.`;
  }
  return `Up to ${formatCount(affected)} downloaded ${affected === 1 ? 'video' : 'videos'} will be marked missing: every one whose file the rescan cannot find.`;
}

function acknowledgement(affected: number, exact: boolean): string {
  if (!exact) return 'I removed these videos\' files myself';
  return affected === 1 ? 'I removed this video\'s file myself' : `I removed these ${formatCount(affected)} videos' files myself`;
}

// Confirms a rescan that skips the unmounted-drive check and the hold on a
// folder where most videos were not found: the escape for files the user
// removed on purpose. Says how many videos it affects, and asks the user to
// say they removed them, since a moved library looks exactly the same.
const RescanAnywayDialog: React.FC<RescanAnywayDialogProps> = ({
  open, onClose, onConfirm, pending, folderMessage, affected, present, exact,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  // Every opening asks again.
  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  return (
    <ConfirmDialog
      open={open}
      tone="warning"
      title="Rescan anyway"
      confirmLabel="Rescan anyway"
      confirmDisabled={pending || !acknowledged}
      onCancel={onClose}
      onConfirm={onConfirm}
    >
      <div className="space-y-3">
        <Typography variant="body2" className="break-words">
          {folderMessage ?? 'The last rescan could not find most of the videos stored in a folder.'} Youtarr is not
          marking the videos stored there missing, in case a drive or network share is unmounted. Only continue if you
          removed the files yourself. If a drive or network share is unmounted, mount it instead.
        </Typography>
        <Typography variant="body2">
          If you moved your library on the host, change the volume mapping for the downloads folder in your Docker
          setup and restart Youtarr instead. Changing YOUTUBE_OUTPUT_DIR alone does not move it.
        </Typography>
        <Typography variant="body2" className="font-semibold">
          {describeAffected(affected, present, exact)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You can then mark them as deleted from this card.
        </Typography>
        <Alert severity="warning">
          Nothing on disk is touched, but with a drive unmounted this would mark every video on it missing.
        </Alert>
        <FormControlLabel
          control={<Checkbox checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />}
          label={acknowledgement(affected, exact)}
        />
      </div>
    </ConfirmDialog>
  );
};

export default RescanAnywayDialog;
