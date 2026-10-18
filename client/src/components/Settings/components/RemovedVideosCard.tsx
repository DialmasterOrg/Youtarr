import React, { useState } from 'react';
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

interface RemovedVideosCardProps {
  token: string | null;
}

const videos = (n: number) => (n === 1 ? 'video' : 'videos');

// Settings > Maintenance: what Deleted and Missing mean, how many there are,
// and the two ways to clear them out.
function RemovedVideosCard({ token }: RemovedVideosCardProps) {
  const { summary, loading, error, markAllMissingDeleted, emptyTrash, actionPending, actionError } = useRemovedVideos(token);
  const [markAllOpen, setMarkAllOpen] = useState(false);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const deleted = summary?.deleted ?? 0;
  const missing = summary?.missing ?? 0;
  const legacy = summary?.legacy ?? 0;
  const libraryWarning = summary && !summary.libraryCheck.ok ? summary.libraryCheck.message : null;

  const handleMarkAll = async () => {
    setSuccessMessage(null);
    const result = await markAllMissingDeleted();
    setMarkAllOpen(false);
    if (result) setSuccessMessage(`Marked ${result.updated} ${videos(result.updated)} as deleted.`);
  };

  const handleEmptyTrash = async (options: EmptyTrashOptions) => {
    setSuccessMessage(null);
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
          </Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {actionError && <Alert severity="error">{actionError}</Alert>}
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
            disabled={!summary || deleted + missing === 0 || actionPending}
            onClick={() => setEmptyTrashOpen(true)}
          >
            Empty trash...
          </Button>
        </div>
      </div>

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
        pending={actionPending}
      />
    </ConfigurationCard>
  );
}

export default RemovedVideosCard;
