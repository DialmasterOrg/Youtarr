import React, { useId, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '../../../ui';
import { Add } from '../../../../lib/icons';
import { TitleShow, TitleShowDraft } from '../../../../types/titleShows';
import { ReorganizeChange } from '../../../../types/reorganize';
import { libraryFolderLabel } from '../../../../utils/libraryLayouts';
import { isReorganizeRequired } from '../../../shared/Reorganize/reorganizeErrors';
import { useTitleShowPreview } from '../../hooks/useTitleShowPreview';
import { ShowFolderTakenError } from '../../hooks/useTitleShows';
import PatternRow from './PatternRow';
import SeasonNamesEditor from './SeasonNamesEditor';
import TitleShowPreviewTabs from './TitleShowPreviewTabs';
import { EMPTY_PATTERN, useTitleShowForm } from './useTitleShowForm';

const SYNTAX_HELP = 'Placeholders: {season}, {episode}, {title} (the episode title), {episode_end} and {part} (recognized, '
  + 'not placed yet). * matches any text, a space any spaces, letters ignore case; start with ^ to match from the start of the title.';
const NO_TV_FOLDER = 'Set up a TV folder first: switch this channel to TV show above, or set a folder to TV shows in '
  + 'Settings > Library folders.';
const EXCLUDE_HELP = 'One per line. A title containing any of them never joins this show (another show can still take it).';

export interface TitleShowEditorDialogProps {
  open: boolean;
  token: string | null;
  channelId: string;
  /** The show being edited, or null for a new one */
  show: TitleShow | null;
  /** The channel's active shows as drafts, in order (the edited one included) */
  drafts: TitleShowDraft[];
  tvFolders: string[];
  defaultLibraryFolder: string | null;
  onClose: () => void;
  /** Save the show; rejects like useTitleShows' changes */
  onSave: (draft: TitleShowDraft) => Promise<void>;
  /** The save moves downloaded videos: review this change instead */
  onReviewMove: (change: ReorganizeChange) => void;
  /** Restore a removed show that used the folder */
  onRestore?: (showId: number) => Promise<void>;
}

/** Add or edit a title show: name, folder, patterns, exclude terms, season names, with a live preview. */
function TitleShowEditorDialog({
  open, token, channelId, show, drafts, tvFolders, defaultLibraryFolder, onClose, onSave, onReviewMove, onRestore,
}: TitleShowEditorDialogProps) {
  const folderLabelId = useId();
  const defaultFolder = show ? show.libraryFolder : defaultLibraryFolder ?? tvFolders[0] ?? '';
  const { form, update, draft, valid } = useTitleShowForm(open, show, defaultFolder);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [taken, setTaken] = useState<ShowFolderTakenError | null>(null);

  // The channel's whole set of shows with this one in place, as the server classifies them.
  const index = show ? drafts.findIndex((entry) => entry.id === show.id) : drafts.length;
  const showKey = show ? `title:${show.id}` : `new:${index}`;
  const previewShows = useMemo(() => (show
    ? drafts.map((entry) => (entry.id === show.id ? draft : entry))
    : [...drafts, draft]), [drafts, draft, show]);
  const { preview, loading, error, current } = useTitleShowPreview(channelId, token, previewShows, { enabled: open && valid });
  const compiled = preview?.compiled.find((entry) => entry.key === showKey)?.patterns ?? [];

  const setPattern = (position: number, pattern: typeof form.patterns[number]) => {
    update({ patterns: form.patterns.map((entry, i) => (i === position ? pattern : entry)) });
  };
  const movePattern = (from: number, to: number) => {
    const patterns = [...form.patterns];
    const [moved] = patterns.splice(from, 1);
    patterns.splice(to, 0, moved);
    update({ patterns });
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setTaken(null);
    try {
      await onSave(draft);
      onClose();
    } catch (err: unknown) {
      if (isReorganizeRequired(err)) onReviewMove(err.change);
      else if (err instanceof ShowFolderTakenError) setTaken(err);
      else setSaveError(err instanceof Error ? err.message : 'Failed to save the show');
    } finally {
      setSaving(false);
    }
  };

  const noTvFolder = tvFolders.length === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle onClose={onClose}>{show ? `Edit ${show.name}` : 'Add a show'}</DialogTitle>
      <DialogContent>
        <Box className="flex flex-col gap-4 pt-2">
          {noTvFolder && <Alert severity="warning">{NO_TV_FOLDER}</Alert>}
          <Box className="flex flex-wrap gap-3">
            <TextField
              label="Show name" size="small" className="min-w-[220px] flex-1" value={form.name}
              onChange={(event) => update({ name: event.target.value })}
            />
            <TextField
              label="Folder name" size="small" className="min-w-[220px] flex-1" value={form.folderName}
              placeholder="Same as the name" onChange={(event) => update({ folderName: event.target.value })}
            />
            {!noTvFolder && (
              <FormControl className="min-w-[180px]">
                <InputLabel id={folderLabelId} shrink>TV folder</InputLabel>
                <Select labelId={folderLabelId} size="small" value={form.libraryFolder} onChange={(event) => update({ libraryFolder: String(event.target.value) })}>
                  {tvFolders.map((folder) => <MenuItem key={folder || '(main)'} value={folder}>{libraryFolderLabel(folder)}</MenuItem>)}
                </Select>
              </FormControl>
            )}
          </Box>

          <Box className="flex flex-col gap-2">
            <Typography variant="body2" className="font-semibold">Title patterns</Typography>
            <Typography variant="caption" color="text.secondary">{SYNTAX_HELP}</Typography>
            {form.patterns.map((pattern, position) => (
              <PatternRow
                // Patterns have no identity beyond their position while being edited.
                // eslint-disable-next-line react/no-array-index-key
                key={position}
                index={position}
                count={form.patterns.length}
                pattern={pattern}
                compiledRegex={current ? compiled[position] ?? null : null}
                onChange={(next) => setPattern(position, next)}
                onRemove={() => update({ patterns: form.patterns.filter((_, i) => i !== position) })}
                onMove={(to) => movePattern(position, to)}
              />
            ))}
            <Box>
              <Button variant="text" size="small" startIcon={<Add size={16} />} onClick={() => update({ patterns: [...form.patterns, { ...EMPTY_PATTERN }] })}>
                Add a pattern
              </Button>
            </Box>
          </Box>

          <Box className="flex flex-wrap gap-4">
            <Box className="min-w-[260px] flex-1">
              <TextField
                label="Exclude titles containing" multiline rows={3} size="small" fullWidth value={form.excludeText}
                helperText={EXCLUDE_HELP} onChange={(event) => update({ excludeText: event.target.value })}
              />
            </Box>
            <Box className="min-w-[260px] flex-1">
              <SeasonNamesEditor rows={form.seasonRows} onChange={(seasonRows) => update({ seasonRows })} />
            </Box>
          </Box>

          {saveError && <Alert severity="error">{saveError}</Alert>}
          {taken && (
            <Alert severity="warning">
              <Typography variant="body2">{taken.message}</Typography>
              <Box className="mt-2 flex flex-wrap gap-2">
                {taken.suggestion && (
                  <Button size="small" variant="outlined" onClick={() => { update({ folderName: taken.suggestion || '' }); setTaken(null); }}>
                    {`Use "${taken.suggestion}"`}
                  </Button>
                )}
                {taken.retiredShowId !== null && onRestore && (
                  <Button size="small" variant="outlined" onClick={() => { void onRestore(taken.retiredShowId as number); onClose(); }}>
                    Restore the removed show
                  </Button>
                )}
              </Box>
            </Alert>
          )}

          <Box className="flex flex-col gap-2">
            <Typography variant="body2" className="font-semibold">Preview</Typography>
            {valid
              ? <TitleShowPreviewTabs preview={preview} showKey={showKey} loading={loading} error={error} />
              : <Typography variant="body2" color="text.secondary">Name the show and write a pattern to preview it.</Typography>}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid || saving || noTvFolder}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}
          onClick={() => { void save(); }}
        >
          Save show
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TitleShowEditorDialog;
