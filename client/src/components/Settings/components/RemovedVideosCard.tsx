import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Typography,
} from '../../ui';
import { Checkbox, FormControlLabel } from '../../ui/form';
import ConfirmDialog from '../../shared/ConfirmDialog';
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
  // Videos the last rescan did not mark missing because it could not find most
  // of a folder's videos (or the folder looked unmounted); 0 when none.
  rescanHeldBack?: number;
}

const RESCAN_NOT_STARTED = 'The rescan did not start. The rescan card above shows why.';
const RESCAN_STARTED = 'Rescan started. When it finishes, the missing videos can be marked as deleted here.';
const RESCAN_FINISHED = 'Rescan finished. Videos it could not find now count as missing and can be marked as deleted.';
const EMPTIED_MYSELF = 'I removed these files myself; they are not on an unmounted drive';

const videos = (n: number) => (n === 1 ? 'video' : 'videos');
const formatCount = (n: number) => n.toLocaleString('en-US');

// Check results that can also mean the user removed the files on purpose,
// the one case where rescanning anyway, or marking every missing video as
// deleted despite the check, makes sense.
const OVERRIDABLE_REASONS = ['empty', 'subfolder-empty', 'not-found'];
// Of these, the ones where Rescan anyway marks every covered video missing;
// for the others it marks only those it cannot find.
const EVERY_VIDEO_REASONS = ['empty', 'subfolder-empty'];
// Missing counts as "most of the library" from this many videos and at least
// as many missing videos as present ones.
const MOSTLY_MISSING_MIN = 25;

// Settings > Maintenance: what Deleted and Missing mean, how many there are,
// and the two ways to clear them out.
function RemovedVideosCard({ token, onRescanAnyway, rescanRunning = false, rescanHeldBack = 0 }: RemovedVideosCardProps) {
  const { summary, loading, error, refetch, markAllMissingDeleted, emptyTrash, actionPending, actionError } = useRemovedVideos(token);
  const [markAllOpen, setMarkAllOpen] = useState(false);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [rescanAnywayOpen, setRescanAnywayOpen] = useState(false);
  const [rescanAnywayError, setRescanAnywayError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emptiedAcknowledged, setEmptiedAcknowledged] = useState(false);
  // A rescan anyway was asked for and has not finished yet.
  const awaitingRescanAnyway = useRef(false);

  const deleted = summary?.deleted ?? 0;
  const missing = summary?.missing ?? 0;
  const legacy = summary?.legacy ?? 0;
  const present = summary?.present ?? 0;
  const libraryWarning = summary && !summary.libraryCheck.ok ? summary.libraryCheck.message : null;
  const checkReason = summary?.libraryCheck.reason ?? '';
  // The failing folder holds missing videos, so they are in doubt.
  const missingBlocked = summary?.missingActionsBlocked ?? false;
  // Missing videos cannot be purged while that holds, so with no deleted ones
  // there would be nothing the dialog could offer.
  const nothingToPurge = deleted === 0 && (missing === 0 || missingBlocked);
  const archiveRemovalDisabledReason = summary?.downloadsActive ? 'Unavailable while a download is running.' : null;
  // The files may simply have been removed on purpose: the user can say so.
  const folderLooksEmpty = libraryWarning !== null && OVERRIDABLE_REASONS.includes(checkReason);
  // What Rescan anyway would do: from the live check if it fails, else from
  // what the last rescan held back.
  const rescanAffects = folderLooksEmpty ? summary?.presentCovered ?? 0 : rescanHeldBack;
  const rescanMarksEvery = folderLooksEmpty && EVERY_VIDEO_REASONS.includes(checkReason);
  const canRescanAnyway = Boolean(onRescanAnyway) && rescanAffects > 0 && (folderLooksEmpty || libraryWarning === null);
  const needsEmptiedAcknowledgement = missingBlocked && folderLooksEmpty;
  const mostlyMissingWarning = missing >= MOSTLY_MISSING_MIN && missing >= present
    ? `${formatCount(missing)} of your ${formatCount(missing + present)} downloaded videos are missing. If you moved your library `
      + 'or changed the volume mapping, fix that, restart Youtarr and rescan before you mark them as deleted or empty the trash.'
    : null;
  // Mostly missing is treated like an unmounted folder here too: no check may
  // be failing (a wrong folder that is not empty), so the user says so instead.
  const needsGoneAcknowledgement = needsEmptiedAcknowledgement || mostlyMissingWarning !== null;

  // A rescan that just finished may have marked videos missing: reload the counts.
  const wasRescanRunning = useRef(rescanRunning);
  useEffect(() => {
    if (wasRescanRunning.current && !rescanRunning) {
      void refetch();
      if (awaitingRescanAnyway.current) {
        awaitingRescanAnyway.current = false;
        setSuccessMessage(RESCAN_FINISHED);
      }
    }
    wasRescanRunning.current = rescanRunning;
  }, [rescanRunning, refetch]);

  const handleRescanAnyway = async () => {
    if (!onRescanAnyway) return;
    setSuccessMessage(null);
    setRescanAnywayError(null);
    awaitingRescanAnyway.current = true;
    const { started } = await onRescanAnyway();
    setRescanAnywayOpen(false);
    if (!started) {
      awaitingRescanAnyway.current = false;
      // A refused start flips the rescan's running state on and off, which
      // may already have reported it finished.
      setSuccessMessage(null);
      setRescanAnywayError(RESCAN_NOT_STARTED);
    } else if (awaitingRescanAnyway.current) {
      // Unless a quick rescan already finished and said so.
      setSuccessMessage(RESCAN_STARTED);
    }
  };

  const openMarkAll = () => {
    setEmptiedAcknowledged(false);
    setMarkAllOpen(true);
  };

  const handleMarkAll = async () => {
    setSuccessMessage(null);
    setRescanAnywayError(null);
    // This result is the news now; a rescan finishing later must not replace it.
    awaitingRescanAnyway.current = false;
    const result = await markAllMissingDeleted({ ignoreLibraryCheck: needsEmptiedAcknowledgement });
    setMarkAllOpen(false);
    if (result) setSuccessMessage(`Marked ${result.updated} ${videos(result.updated)} as deleted.`);
  };

  const handleEmptyTrash = async (options: EmptyTrashOptions) => {
    setSuccessMessage(null);
    setRescanAnywayError(null);
    awaitingRescanAnyway.current = false;
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
          <Alert severity="warning" className="break-words">
            {missingBlocked
              ? folderLooksEmpty
                ? `${libraryWarning} Until that changes, missing videos stored there cannot be emptied from the trash;`
                  + ' Mark all missing as deleted asks you to confirm that you removed the files yourself.'
                  + (canRescanAnyway ? ' Rescan anyway first if some of the videos stored there still show as available.' : '')
                : `${libraryWarning} Until that changes, marking or emptying missing videos is disabled.`
              : `${libraryWarning} Until that changes, videos stored there are not being marked missing.`
                + (canRescanAnyway ? ' If you removed the files yourself, rescan anyway to mark them missing.' : '')}
          </Alert>
        )}
        {!libraryWarning && canRescanAnyway && (
          <Alert severity="warning" className="break-words">
            {`The last rescan did not mark ${formatCount(rescanHeldBack)} ${videos(rescanHeldBack)} missing because it could not`
              + ' find most of the videos where they are stored. If you moved your library or changed the volume mapping, fix'
              + ' that and restart Youtarr. If you removed the files yourself, rescan anyway to mark them missing.'}
          </Alert>
        )}
        {!libraryWarning && mostlyMissingWarning && (
          <Alert severity="warning" className="break-words">{mostlyMissingWarning}</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {actionError && <Alert severity="error">{actionError}</Alert>}
        {rescanAnywayError && <Alert severity="error">{rescanAnywayError}</Alert>}
        {successMessage && <Alert severity="success">{successMessage}</Alert>}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outlined"
            disabled={!summary || missing === 0 || (missingBlocked && !folderLooksEmpty) || rescanRunning || actionPending}
            onClick={openMarkAll}
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
        folderMessage={folderLooksEmpty ? libraryWarning : null}
        affected={rescanAffects}
        present={present}
        exact={rescanMarksEvery}
      />

      <ConfirmDialog
        open={markAllOpen}
        tone="warning"
        title="Mark all missing videos as deleted"
        confirmLabel={`Mark ${missing} as deleted`}
        confirmDisabled={actionPending || (needsGoneAcknowledgement && !emptiedAcknowledged)}
        onCancel={() => setMarkAllOpen(false)}
        onConfirm={handleMarkAll}
      >
        <div className="space-y-3">
          <Typography variant="body2">
            {missing === 1
              ? '1 missing video will be marked as deleted and hidden from the Videos page by default. Its record is kept, so it can still be re-downloaded, and if its file turns up again the rescan marks it downloaded. Only do this if the file is really gone, not sitting on an unmounted drive.'
              : `${missing} missing videos will be marked as deleted and hidden from the Videos page by default. Their records are kept, so they can still be re-downloaded, and if a file turns up again the rescan marks it downloaded. Only do this if the files are really gone, not sitting on an unmounted drive.`}
          </Typography>
          {mostlyMissingWarning && (
            <Alert severity="warning" className="break-words">{mostlyMissingWarning}</Alert>
          )}
          {needsEmptiedAcknowledgement && (
            <Alert severity="warning" className="break-words">{libraryWarning}</Alert>
          )}
          {needsGoneAcknowledgement && (
            <FormControlLabel
              control={
                <Checkbox checked={emptiedAcknowledged} onChange={(event) => setEmptiedAcknowledged(event.target.checked)} />
              }
              label={EMPTIED_MYSELF}
            />
          )}
        </div>
      </ConfirmDialog>

      <EmptyTrashDialog
        open={emptyTrashOpen}
        onClose={() => setEmptyTrashOpen(false)}
        onConfirm={handleEmptyTrash}
        counts={{ deleted, missing }}
        missingDisabledReason={missingBlocked ? libraryWarning : null}
        missingWarning={mostlyMissingWarning}
        archiveRemovalDisabledReason={archiveRemovalDisabledReason}
        pending={actionPending}
      />
    </ConfigurationCard>
  );
}

export default RemovedVideosCard;
