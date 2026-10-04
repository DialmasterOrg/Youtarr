import React, { useId, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '../../ui';
import { ChannelTvState, LibraryFolder, LibraryLayout } from '../../../types/tvShows';
import { libraryFolderLabel } from '../../../utils/libraryLayouts';
import TvFolderSetup from './TvFolderSetup';

/** The server's refusal when it can't tell which Videos folder to switch back to. */
export const CHOOSE_VIDEOS_FOLDER_MESSAGE = 'Choose a Videos folder.';
const SWITCH_FAILED_MESSAGE = "Couldn't switch this channel's layout.";
const HAS_DOWNLOADS_NOTE = 'This channel has downloaded videos: switching moves them, and you review the move first.';
const SWITCH_SAVES_NOTE = 'Switching saves right away.';
const REORGANIZING_NOTE = "This channel's downloaded videos are being moved.";
const DEFAULT_FOLDER_TV_NOTE =
  "The default subfolder is a TV folder, so downloads from channels you haven't subscribed to are each saved as their own TV show.";
const NO_VIDEOS_FOLDER_MESSAGE = 'No library folder uses the Videos layout yet.';
const PLEX_SETUP_NOTE =
  'Plex: add a TV Shows library for this folder (scanner Plex TV Series, agent Plex Personal Media or Plex NFO Series). '
  + 'Then map the folder under Settings > Plex > subfolder library mappings so new episodes refresh it.';
const JELLYFIN_EMBY_SETUP_NOTE =
  'Jellyfin and Emby: add a Shows library for this folder with the NFO reader on, NFO saving off and online metadata off.';

type Step = 'idle' | 'pickTv' | 'pickVideos' | 'setupTv';

export interface ChannelTvSectionProps {
  channelName: string;
  tv: ChannelTvState | null;
  loading: boolean;
  error: string | null;
  /** Library folders with their layouts, for the Videos folder picker */
  folders: LibraryFolder[];
  /** Switches the channel's layout; rejects with the server's refusal message */
  onSwitch: (layout: LibraryLayout, folder?: string) => Promise<void>;
  createSubfolder: (name: string) => Promise<void>;
  setFolderLayout: (name: string, layout: LibraryLayout) => Promise<void>;
  /** Show the result of the reorganize that left some of this channel's videos unmoved */
  onShowReorganize?: (operationId: number) => void;
  disabled?: boolean;
}

interface FolderPickerProps {
  prompt: string;
  label: string;
  folders: string[];
  value: string;
  onChange: (value: string) => void;
  actionLabel: string;
  onConfirm: () => void;
  disabled: boolean;
}

function FolderPicker({ prompt, label, folders, value, onChange, actionLabel, onConfirm, disabled }: FolderPickerProps) {
  const labelId = useId();
  return (
    <Box className="flex flex-col gap-2 rounded-[var(--radius-ui)] border border-border p-3">
      <Typography variant="body2">{prompt}</Typography>
      <FormControl fullWidth>
        <InputLabel id={labelId} shrink>
          {label}
        </InputLabel>
        <Select
          labelId={labelId}
          size="small"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(String(event.target.value))}
        >
          {folders.map((folder) => (
            <MenuItem key={folder || '(main)'} value={folder}>
              {libraryFolderLabel(folder)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Box>
        <Button variant="contained" size="small" disabled={disabled} onClick={onConfirm}>
          {actionLabel}
        </Button>
      </Box>
    </Box>
  );
}

function MediaServerSetupNotes() {
  return (
    <Box className="flex flex-col gap-1 rounded-[var(--radius-ui)] bg-muted p-3">
      <Typography variant="body2" className="font-semibold">
        Media server setup
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {PLEX_SETUP_NOTE}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {JELLYFIN_EMBY_SETUP_NOTE}
      </Typography>
    </Box>
  );
}

/** Channel Settings section that switches a channel between Videos and TV show. */
function ChannelTvSection({
  channelName,
  tv,
  loading,
  error,
  folders,
  onSwitch,
  createSubfolder,
  setFolderLayout,
  onShowReorganize,
  disabled = false,
}: ChannelTvSectionProps) {
  const headingId = useId();
  const [step, setStep] = useState<Step>('idle');
  const [pending, setPending] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [tvChoice, setTvChoice] = useState('');
  const [videosChoice, setVideosChoice] = useState('');

  if (!tv) {
    if (error && !loading) {
      return <Alert severity="error">{error}</Alert>;
    }
    return (
      <Box className="flex justify-center py-10">
        <CircularProgress />
      </Box>
    );
  }

  const isTv = tv.layout === 'tv';
  const reorganizing = Boolean(tv.reorganize?.running);
  const unmoved = tv.reorganize?.unmoved ?? null;
  const locked = reorganizing || pending || disabled;
  const videosFolders = folders.filter((folder) => folder.layout === 'videos').map((folder) => folder.name);

  const runSwitch = async (layout: LibraryLayout, folder?: string) => {
    setPending(true);
    setSwitchError(null);
    try {
      await onSwitch(layout, folder);
      setStep('idle');
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : SWITCH_FAILED_MESSAGE;
      if (layout === 'videos' && folder === undefined && message === CHOOSE_VIDEOS_FOLDER_MESSAGE) {
        setVideosChoice(videosFolders[0] ?? '');
        setStep('pickVideos');
      } else {
        setSwitchError(message);
      }
    } finally {
      setPending(false);
    }
  };

  const chooseVideos = () => {
    setSwitchError(null);
    if (!isTv) {
      setStep('idle');
      return;
    }
    void runSwitch('videos');
  };

  const chooseTv = () => {
    setSwitchError(null);
    if (isTv) {
      setStep('idle');
      return;
    }
    if (tv.defaultFolderLayout === 'tv' || tv.tvFolders.length === 1) {
      void runSwitch('tv');
      return;
    }
    if (tv.tvFolders.length > 1) {
      setTvChoice(tv.tvFolders[0]);
      setStep('pickTv');
      return;
    }
    setStep('setupTv');
  };

  const handleSetupSwitch = async (layout: LibraryLayout, folder: string) => {
    await onSwitch(layout, folder);
    setStep('idle');
  };

  const destination = isTv
    ? `Episodes go to ${libraryFolderLabel(tv.show?.libraryFolder ?? tv.libraryFolder)}/${tv.show?.folderName ?? channelName}/Season YYYY/`
    : `Videos are saved movie-style in ${libraryFolderLabel(tv.libraryFolder)}.`;

  return (
    <Box className="flex flex-col gap-4">
      <Box className="flex flex-col gap-2">
        <Typography id={headingId} variant="subtitle2" className="font-semibold">
          Show this channel as
        </Typography>
        <Box role="group" aria-labelledby={headingId} className="flex flex-wrap gap-2">
          <Button
            variant={isTv ? 'outlined' : 'contained'}
            color={isTv ? 'inherit' : 'primary'}
            size="small"
            aria-pressed={!isTv}
            disabled={locked}
            onClick={chooseVideos}
          >
            Videos
          </Button>
          <Button
            variant={isTv ? 'contained' : 'outlined'}
            color={isTv ? 'primary' : 'inherit'}
            size="small"
            aria-pressed={isTv}
            disabled={locked}
            onClick={chooseTv}
          >
            TV show
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {destination}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {tv.hasDownloads ? HAS_DOWNLOADS_NOTE : SWITCH_SAVES_NOTE}
        </Typography>
      </Box>

      {reorganizing && <Alert severity="info">{REORGANIZING_NOTE}</Alert>}

      {!reorganizing && unmoved && unmoved.failed > 0 && (
        <Alert
          severity="warning"
          action={onShowReorganize ? (
            <Button size="small" variant="outlined" onClick={() => onShowReorganize(unmoved.operationId)}>Review</Button>
          ) : undefined}
        >
          {unmoved.failed === 1 ? '1 video was' : `${unmoved.failed} videos were`} not moved when this channel was reorganized.
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {switchError && (
        <Alert severity="error" onClose={() => setSwitchError(null)}>
          {switchError}
        </Alert>
      )}

      {step === 'pickTv' && !isTv && (
        <FolderPicker
          prompt="Choose the TV folder for this channel's show."
          label="TV folder"
          folders={tv.tvFolders}
          value={tvChoice}
          onChange={setTvChoice}
          actionLabel="Switch to TV show"
          onConfirm={() => { void runSwitch('tv', tvChoice); }}
          disabled={locked}
        />
      )}

      {step === 'pickVideos' && isTv && (videosFolders.length > 0 ? (
        <FolderPicker
          prompt="Choose the Videos folder to save this channel in."
          label="Videos folder"
          folders={videosFolders}
          value={videosChoice}
          onChange={setVideosChoice}
          actionLabel="Switch to Videos"
          onConfirm={() => { void runSwitch('videos', videosChoice); }}
          disabled={locked}
        />
      ) : (
        <Alert severity="warning">{NO_VIDEOS_FOLDER_MESSAGE}</Alert>
      ))}

      {step === 'setupTv' && !isTv && (
        <TvFolderSetup
          createSubfolder={createSubfolder}
          setFolderLayout={setFolderLayout}
          onSwitch={handleSetupSwitch}
          disabled={locked}
        />
      )}

      {tv.defaultFolderLayout === 'tv' && <Alert severity="info">{DEFAULT_FOLDER_TV_NOTE}</Alert>}

      {(isTv || step === 'setupTv') && <MediaServerSetupNotes />}
    </Box>
  );
}

export default ChannelTvSection;
