import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '../../ui';
import { ConfigurationCard } from '../../Configuration/common/ConfigurationCard';
import { useRemovedVideos, type EmptyTrashOptions } from '../hooks/useRemovedVideos';
import EmptyTrashDialog from './EmptyTrashDialog';
import RescanAnywayDialog from './RescanAnywayDialog';

interface RemovedVideosCardProps {
  token: string | null;
  // Starts a rescan that skips the unmounted-drive check; Maintenance wires it
  // in. Resolves started: false when the server refused or the request failed.
  onRescanAnyway?: () => Promise<{ started: boolean }>;
  rescanRunning?: boolean;
}

const RESCAN_NOT_STARTED = 'The rescan did not start. The rescan card above shows why.';

const videos = (n: number) => (n === 1 ? 'video' : 'videos');

// Check results that can also mean the user emptied the folder on purpose,
// the one case where rescanning anyway makes sense.
const EMPTY_FOLDER_REASONS = ['empty', 'subfolder-empty'];

// Settings > Maintenance: what Deleted and Missing mean, how many there are,
// and the two ways to clear them out.
function RemovedVideosCard({ token, onRescanAnyway, rescanRunning = false }: RemovedVideosCardProps) {
  const { summary, loading, error, refetch, markAllMissingDeleted, emptyTrash, actionPending, actionError } = useRemovedVideos(token);
  const [markAllOpen, setMarkAllOpen] = useState(false);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [rescanAnywayOpen, setRescanAnywayOpen] = useState(false);
  const [rescanAnywayError, setRescanAnywayError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const deleted = summary?.deleted ?? 0;
  const missing = summary?.missing ?? 0;
  const legacy = summary?.legacy ?? 0;
  const libraryWarning = summary && !summary.libraryCheck.ok ? summary.libraryCheck.message : null;
  // Missing videos cannot be purged while the folder looks unmounted, so with
  // no deleted ones there would be nothing the dialog could offer.
  const nothingToPurge = deleted === 0 && (missing === 0 || libraryWarning !== null);
  const archiveRemovalDisabledReason = summary?.downloadsActive ? 'Unavailable while a download is running.' : null;
  const canRescanAnyway = Boolean(onRescanAnyway) && summary !== null && !summary.libraryCheck.ok
    && EMPTY_FOLDER_REASONS.includes(summary.libraryCheck.reason ?? '');

  // A rescan that just finished may have marked videos missing: reload the counts.
  const wasRescanRunning = useRef(rescanRunning);
  useEffect(() => {
    if (wasRescanRunning.current && !rescanRunning) void refetch();
    wasRescanRunning.current = rescanRunning;
  }, [rescanRunning, refetch]);

  const handleRescanAnyway = async () => {
    if (!onRescanAnyway) return;
    setSuccessMessage(null);
    setRescanAnywayError(null);
    const { started } = await onRescanAnyway();
    setRescanAnywayOpen(false);
    if (started) {
      setSuccessMessage('Rescan started. When it finishes, the missing videos can be marked as deleted here.');
    } else {
      setRescanAnywayError(RESCAN_NOT_STARTED);
    }
  };

  const handleMarkAll = async () => {
    setSuccessMessage(null);
    setRescanAnywayError(null);
    const result = await markAllMissingDeleted();
    setMarkAllOpen(false);
    if (result) setSuccessMessage(`Marked ${result.updated} ${videos(result.updated)} as deleted.`);
  };

  const handleEmptyTrash = async (options: EmptyTrashOptions) => {
    setSuccessMessage(null);
    setRescanAnywayError(null);
    const result = await emptyTrash(options);
    setEmptyTrashOpen(false);
    if (!result) return;
    const archive = result.archiveEntriesRemoved > 0
      ? `, ${result.archiveEntriesRemoved} download archive ${result.archiveEntriesRemoved === 1 ? 'entry' : 'entries'} removed`
      : '';
    setSuccessMessage(`Emptied trash: ${result.purged} ${videos(result.purged)} removed${archive}.`);
  };

  return (
    <ConfigurationCard title="Deleted and missing videos">
      <div className="flex flex-col gap-4">
        <Typography variant="body2" color="text.secondary">
          Videos whose files are no longer on disk stay in Youtarr&apos;s library so they can be re-downloaded.
          Deleted means Youtarr removed the file: a delete in the app, automatic cleanup, or you marked a missing
          video as deleted. Missing means Youtarr expected a file and could not find it. The Videos page hides
          deleted videos by default and shows missing ones so you can check on them.
        </Typography>

        {loading && !summary && (
          <Typography variant="body2" color="text.secondary">Counting deleted and missing videos...</Typography>
        )}
        {summary && (
          <Typography variant="body2">
            {`Deleted: ${deleted}${legacy > 0 ? ` (${legacy} removed before Youtarr recorded why)` : ''}. Missing: ${missing}.`}
          </Typography>
        )}

        {libraryWarning && (
          <Alert severity="warning">
            {libraryWarning} Marking or emptying missing videos is disabled until it is back.
            {canRescanAnyway && (
              ' If the folder really is empty because you removed the files yourself, you can rescan anyway and then mark the missing videos as deleted.'
            )}
          </Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {actionError && <Alert severity="error">{actionError}</Alert>}
        {rescanAnywayError && <Alert severity="error">{rescanAnywayError}</Alert>}
        {successMessage && <Alert severity="success">{successMessage}</Alert>}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outlined"
            disabled={!summary || missing === 0 || libraryWarning !== null || actionPending}
            onClick={() => setMarkAllOpen(true)}
          >
            Mark all missing as deleted
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={!summary || nothingToPurge || actionPending}
            onClick={() => {
              // The download state is a snapshot; refresh it as the dialog opens.
              void refetch();
              setEmptyTrashOpen(true);
            }}
          >
            Empty trash...
          </Button>
          {canRescanAnyway && (
            <Button
              variant="outlined"
              color="warning"
              disabled={rescanRunning || actionPending}
              onClick={() => setRescanAnywayOpen(true)}
            >
              Rescan anyway...
            </Button>
          )}
        </div>
      </div>

      <RescanAnywayDialog
        open={rescanAnywayOpen}
        onClose={() => setRescanAnywayOpen(false)}
        onConfirm={() => { void handleRescanAnyway(); }}
        pending={rescanRunning}
      />

      <Dialog open={markAllOpen} onClose={() => setMarkAllOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark all missing videos as deleted</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {missing} missing {videos(missing)} will be marked as deleted and hidden from the Videos page by default.
            Their records are kept, so they can still be re-downloaded, and if a file turns up again the rescan
            marks it downloaded. Only do this if the files are really gone, not sitting on an unmounted drive.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkAllOpen(false)} variant="contained" color="primary" autoFocus>
            Cancel
          </Button>
          <Button onClick={handleMarkAll} variant="outlined" color="warning" disabled={actionPending}>
            Mark {missing} as deleted
          </Button>
        </DialogActions>
      </Dialog>

      <EmptyTrashDialog
        open={emptyTrashOpen}
        onClose={() => setEmptyTrashOpen(false)}
        onConfirm={handleEmptyTrash}
        counts={{ deleted, missing }}
        missingDisabledReason={libraryWarning}
        archiveRemovalDisabledReason={archiveRemovalDisabledReason}
        pending={actionPending}
      />
    </ConfigurationCard>
  );
}

export default RemovedVideosCard;
