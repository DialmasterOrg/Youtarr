import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, FormControlLabel, Switch, Typography } from '../../../ui';
import { Add } from '../../../../lib/icons';
import { TitleShow, TitleShowConflict, TitleShowDraft } from '../../../../types/titleShows';
import { ReorganizeChange, ReorganizeStartResult } from '../../../../types/reorganize';
import { isReorganizeRequired } from '../../../shared/Reorganize/reorganizeErrors';
import ReorganizeDialog from '../../../shared/Reorganize/ReorganizeDialog';
import { useReorganizeOutcome } from '../../../shared/Reorganize/hooks/useReorganizeOutcome';
import EpisodeAssignDialog from '../../../shared/EpisodeAssign/EpisodeAssignDialog';
import DeleteVideosDialog from '../../../shared/DeleteVideosDialog';
import { useVideoDeletion } from '../../../shared/useVideoDeletion';
import { useTitleShows } from '../../hooks/useTitleShows';
import TitleShowList from './TitleShowList';
import ConflictList from './ConflictList';
import TitleShowEditorDialog from './TitleShowEditorDialog';

const INTRO = 'Shows built from video titles, such as "Hermitcraft 10: Episode 43". The first show whose pattern matches '
  + 'a title takes the video; the channel\'s other videos follow its layout.';
const SHOW_ONLY_NOTE = 'Channel downloads skip videos no show takes. Download All queues only show episodes.';

/** A stored show as the draft that saves it unchanged. */
export function titleShowToDraft(show: TitleShow): TitleShowDraft {
  return {
    id: show.id,
    name: show.name,
    folderName: show.folderName,
    libraryFolder: show.libraryFolder,
    excludeTerms: show.excludeTerms,
    seasonNames: show.seasonNames,
    patterns: show.patterns.map(({ text, kind, seasonSource, seasonFixed, episodeSource }) => ({
      text, kind, seasonSource, seasonFixed, episodeSource,
    })),
  };
}

interface TitleShowsSectionProps {
  token: string | null;
  channelId: string;
  disabled?: boolean;
  /** The channel's TV layout and folder: a change moves where new shows go */
  tvKey?: string;
  /** A move a change started has ended (its videos may not all have moved) */
  onMoveEnded?: () => void;
}

/** Channel Settings: the channel's title shows, their duplicates, and the show-only download switch. */
function TitleShowsSection({ token, channelId, disabled = false, tvKey = '', onMoveEnded }: TitleShowsSectionProps) {
  const titleShows = useTitleShows(channelId, token);
  const loadedTvKey = useRef(tvKey);
  const { refetch } = titleShows;
  useEffect(() => {
    if (loadedTvKey.current === tvKey) return;
    loadedTvKey.current = tvKey;
    void refetch();
  }, [tvKey, refetch]);
  const { deleteVideos } = useVideoDeletion();
  const [editing, setEditing] = useState<TitleShow | 'new' | null>(null);
  const [move, setMove] = useState<ReorganizeChange | null>(null);
  const [assigning, setAssigning] = useState<TitleShowConflict | null>(null);
  const [deleting, setDeleting] = useState<TitleShowConflict | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // The move a change started: the shows are read again when it ends (the
  // server undoes the change when nothing could move).
  const [trackedMove, setTrackedMove] = useState<{ operationId: number; attempt: number } | null>(null);
  useReorganizeOutcome(token, trackedMove?.operationId ?? null, () => {
    void titleShows.refetch();
    onMoveEnded?.();
  }, {
    attempt: trackedMove?.attempt ?? 0,
  });

  const data = titleShows.data;
  const active = useMemo(() => (data ? data.shows.filter((show) => !show.retired) : []), [data]);
  const retired = useMemo(() => (data ? data.shows.filter((show) => show.retired) : []), [data]);
  const drafts = useMemo(() => active.map(titleShowToDraft), [active]);

  // A change that moves downloaded videos opens the review instead.
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err: unknown) {
      if (isReorganizeRequired(err)) setMove(err.change);
      else setActionError(err instanceof Error ? err.message : 'The change could not be saved');
    } finally {
      setBusy(false);
    }
  };

  const moveShow = (from: number, to: number) => {
    const ids = active.map((show) => show.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    void run(() => titleShows.reorderShows(ids));
  };

  const confirmDelete = async () => {
    const conflict = deleting;
    setDeleting(null);
    if (!conflict || conflict.videoId === null) return;
    await run(async () => {
      const result = await deleteVideos([conflict.videoId as number], token);
      if (!result.success) throw new Error(result.failed[0]?.error || 'Failed to delete the copy');
      await titleShows.refetch();
    });
  };

  if (!data) {
    if (titleShows.error) return <Alert severity="error">{titleShows.error}</Alert>;
    return <Box className="flex justify-center py-6"><CircularProgress /></Box>;
  }
  const locked = disabled || busy;

  return (
    <Box className="flex flex-col gap-3">
      <Box className="flex flex-col gap-1">
        <Typography variant="subtitle2" className="font-semibold">Shows in this channel</Typography>
        <Typography variant="caption" color="text.secondary">{INTRO}</Typography>
      </Box>
      <TitleShowList
        shows={active}
        retired={retired}
        busy={locked}
        onEdit={(show) => setEditing(show)}
        onRemove={(show) => { void run(() => titleShows.retireShow(show.id)); }}
        onRestore={(show) => { void run(() => titleShows.restoreShow(show.id)); }}
        onMove={moveShow}
      />
      <Box>
        <Button variant="outlined" size="small" startIcon={<Add size={16} />} disabled={locked} onClick={() => setEditing('new')}>
          Add show
        </Button>
      </Box>
      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Box className="flex flex-col gap-1">
        <FormControlLabel
          control={(
            <Switch
              checked={data.showOnlyDownloads}
              disabled={locked || active.length === 0}
              onChange={(event) => { void run(() => titleShows.setShowOnly(event.target.checked)); }}
            />
          )}
          label="Only download videos that belong to a show"
        />
        <Typography variant="caption" color="text.secondary">{SHOW_ONLY_NOTE}</Typography>
      </Box>
      <ConflictList
        conflicts={data.conflicts}
        busy={locked}
        onUseCopy={(conflict) => { void run(() => titleShows.takeDuplicateCopy(conflict.youtubeId)); }}
        onAssign={setAssigning}
        onDelete={setDeleting}
        onRecheck={() => { void run(() => titleShows.recheck()); }}
      />

      <TitleShowEditorDialog
        open={editing !== null}
        token={token}
        channelId={channelId}
        show={editing === 'new' ? null : editing}
        drafts={drafts}
        tvFolders={data.tvFolders}
        defaultLibraryFolder={data.defaultLibraryFolder}
        onClose={() => setEditing(null)}
        onSave={(draft) => (draft.id ? titleShows.updateShow(draft.id, draft) : titleShows.createShow(draft))}
        onReviewMove={(change) => { setEditing(null); setMove(change); }}
        onRestore={(showId) => run(() => titleShows.restoreShow(showId))}
      />
      <ReorganizeDialog
        open={move !== null}
        token={token}
        change={move}
        onClose={() => { setMove(null); void titleShows.refetch(); }}
        onApplied={(result: ReorganizeStartResult) => {
          if (result.operationId) setTrackedMove({ operationId: result.operationId, attempt: 0 });
          else void titleShows.refetch();
        }}
        onRetried={(operationId: number) => setTrackedMove((current) => ({
          operationId,
          attempt: current && current.operationId === operationId ? current.attempt + 1 : 1,
        }))}
      />
      <EpisodeAssignDialog
        open={assigning !== null}
        token={token}
        youtubeId={assigning?.youtubeId ?? null}
        videoTitle={assigning?.title ?? null}
        onClose={() => setAssigning(null)}
        onSaved={() => { void titleShows.refetch(); }}
      />
      <DeleteVideosDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={() => { void confirmDelete(); }} videoCount={1} />
    </Box>
  );
}

export default TitleShowsSection;
