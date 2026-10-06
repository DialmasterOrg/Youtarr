import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Typography,
} from '../../../ui';
import { LIBRARY_FOLDERS_UPDATED_EVENT, type UseLibraryFoldersResult } from '../../../../hooks/useLibraryFolders';
import { libraryFolderLabel } from '../../../../utils/libraryLayouts';
import { LibraryFolder, LibraryLayout } from '../../../../types/tvShows';
import { MainFolderTvDialog } from './MainFolderTvDialog';
import { ReorganizeDialog, useReorganizeRequest, isReorganizeRequired } from '../../../shared/Reorganize';
import { LibraryCheckNotes } from '../../../shared/LibraryCheck/LibraryCheckNotes';
import { useLibraryCheck } from '../../../../hooks/useLibraryCheck';
import { folderKey } from '../../../../utils/libraryLayouts';
import { LibraryCheckFolder, LibraryCheckServer } from '../../../../types/libraryCheck';

interface LibraryFoldersListProps {
  /** The section's useLibraryFolders result, shared so the page loads the folders once */
  library: UseLibraryFoldersResult;
  token: string | null;
}

const MAIN_FOLDER = '';
const CHANGE_FAILED = 'Failed to change the folder layout';
const EXPLANATION =
  "Each folder's layout must match its media server library: Videos for a Plex Other Videos or Jellyfin/Emby Movies library, TV shows for a TV library.";
const HAS_FILES_CAPTION = 'Holds downloaded videos: changing its layout moves them, and you review the move first.';
const MEDIA_SERVER_CHECK_CAPTION = 'Under each folder: the media server libraries that hold it, and what to fix.';
const DEFAULT_TV_NOTE =
  "The default subfolder is a TV folder, so downloads from channels you haven't subscribed to are each saved as their own TV show.";

const LAYOUT_OPTIONS: { value: LibraryLayout; label: string }[] = [
  { value: 'videos', label: 'Videos' },
  { value: 'tv', label: 'TV shows' },
];

function channelCountText(count: number): string {
  return count === 1 ? '1 channel' : `${count} channels`;
}

interface LibraryFolderRowProps {
  folder: LibraryFolder;
  disabled: boolean;
  onLayoutChange: (folder: LibraryFolder, layout: LibraryLayout) => void;
  /** The library check's report for this folder, once loaded */
  check?: { report: LibraryCheckFolder; servers: LibraryCheckServer[] } | null;
  onApplyPlexMapping?: (folder: string, libraryId: string) => Promise<void>;
}

const LibraryFolderRow: React.FC<LibraryFolderRowProps> = ({ folder, disabled, onLayoutChange, check, onApplyPlexMapping }) => {
  const label = libraryFolderLabel(folder.name);

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <Box className="min-w-0">
        <Box className="flex flex-wrap items-center gap-2">
          <Typography variant="body2" className="font-medium break-all">
            {label}
          </Typography>
          {folder.isDefault && <Chip label="Default" size="small" variant="outlined" color="primary" />}
        </Box>
        <Typography variant="caption" color="text.secondary" className="block">
          {channelCountText(folder.channels)}
        </Typography>
        {folder.hasFiles && (
          <Typography variant="caption" color="text.secondary" className="block">
            {HAS_FILES_CAPTION}
          </Typography>
        )}
        {check && (
          <Box className="mt-1">
            <LibraryCheckNotes
              folder={check.report}
              servers={check.servers}
              onApplyPlexMapping={onApplyPlexMapping}
              problemsOnly={folder.layout !== 'tv'}
            />
          </Box>
        )}
      </Box>
      <Select
        size="small"
        value={folder.layout}
        disabled={disabled}
        onValueChange={(next) => onLayoutChange(folder, next as LibraryLayout)}
        inputProps={{ 'aria-label': `Layout for ${label}` }}
        className="w-full sm:w-40 shrink-0"
      >
        {LAYOUT_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </li>
  );
};

/** Library folders with their layouts (Videos or TV shows). */
export const LibraryFoldersList: React.FC<LibraryFoldersListProps> = ({ library, token }) => {
  const { folders, loading, error, refetch, setFolderLayout } = library;
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [confirmMainTv, setConfirmMainTv] = useState(false);
  // A layout change that moves downloaded files is reviewed in the reorganize dialog.
  const reorganize = useReorganizeRequest();
  const libraryCheck = useLibraryCheck(token);
  const checkServers = libraryCheck.data?.servers ?? [];
  // Folders in use: TV folders, and Videos folders that hold files or channels.
  const checkFor = (folder: LibraryFolder) => {
    if (checkServers.length === 0 || (folder.layout !== 'tv' && !folder.hasFiles && folder.channels === 0)) return null;
    const report = libraryCheck.data?.folders.find((entry) => folderKey(entry.name) === folderKey(folder.name));
    return report ? { report, servers: checkServers } : null;
  };

  const applyLayout = async (name: string, layout: LibraryLayout) => {
    setChanging(true);
    try {
      await setFolderLayout(name, layout);
      setChangeError(null);
    } catch (err: unknown) {
      if (isReorganizeRequired(err)) {
        setChangeError(null);
        reorganize.review(err.change);
        return;
      }
      setChangeError(err instanceof Error && err.message ? err.message : CHANGE_FAILED);
    } finally {
      setChanging(false);
    }
  };

  // Channels change layout with their folder, so every listener refetches.
  const announceFolderChange = () => window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT));

  const handleReorganizeClosed = () => {
    reorganize.close();
    announceFolderChange();
  };

  const handleLayoutChange = (folder: LibraryFolder, layout: LibraryLayout) => {
    if (layout === folder.layout) return;
    if (folder.name === MAIN_FOLDER && layout === 'tv') {
      setConfirmMainTv(true);
      return;
    }
    void applyLayout(folder.name, layout);
  };

  const handleConfirmMainTv = async () => {
    await applyLayout(MAIN_FOLDER, 'tv');
    setConfirmMainTv(false);
  };

  const defaultIsTv = folders.some((folder) => folder.isDefault && folder.layout === 'tv');

  return (
    <Box className="flex flex-col gap-3">
      <Typography variant="subtitle2" className="font-bold">
        Library folders
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {EXPLANATION}
      </Typography>

      {changeError && (
        <Alert severity="error" onClose={() => setChangeError(null)}>
          {changeError}
        </Alert>
      )}

      {error && (
        <Alert
          severity="error"
          action={
            <Button size="small" variant="text" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {checkServers.length > 0 && (
        <Box className="flex flex-wrap items-center gap-2">
          <Typography variant="caption" color="text.secondary">
            {MEDIA_SERVER_CHECK_CAPTION}
          </Typography>
          <Button size="small" variant="text" loading={libraryCheck.loading} onClick={() => void libraryCheck.refetch()}>
            Check again
          </Button>
        </Box>
      )}
      {libraryCheck.error && <Alert severity="warning">{libraryCheck.error}</Alert>}

      {loading && folders.length === 0 ? (
        <Box className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircularProgress size={16} />
          <span>Loading library folders...</span>
        </Box>
      ) : (
        folders.length > 0 && (
          <Box component="ul" className="m-0 list-none divide-y divide-border border-y border-border p-0">
            {folders.map((folder) => (
              <LibraryFolderRow
                key={folder.name || 'main-folder'}
                folder={folder}
                disabled={changing}
                onLayoutChange={handleLayoutChange}
                check={checkFor(folder)}
                onApplyPlexMapping={libraryCheck.applyPlexMapping}
              />
            ))}
          </Box>
        )
      )}

      {defaultIsTv && <Alert severity="info">{DEFAULT_TV_NOTE}</Alert>}

      <MainFolderTvDialog
        open={confirmMainTv}
        busy={changing}
        onCancel={() => setConfirmMainTv(false)}
        onConfirm={handleConfirmMainTv}
      />

      <ReorganizeDialog
        open={reorganize.open}
        token={token}
        change={reorganize.change}
        operationId={reorganize.operationId}
        onClose={handleReorganizeClosed}
        onApplied={announceFolderChange}
      />
    </Box>
  );
};
