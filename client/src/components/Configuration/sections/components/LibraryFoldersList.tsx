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
import type { UseLibraryFoldersResult } from '../../../../hooks/useLibraryFolders';
import { libraryFolderLabel } from '../../../../utils/libraryLayouts';
import { LibraryFolder, LibraryLayout } from '../../../../types/tvShows';
import { MainFolderTvDialog } from './MainFolderTvDialog';

interface LibraryFoldersListProps {
  /** The section's useLibraryFolders result, shared so the page loads the folders once */
  library: UseLibraryFoldersResult;
}

const MAIN_FOLDER = '';
const CHANGE_FAILED = 'Failed to change the folder layout';
const EXPLANATION =
  "Each folder's layout must match its media server library: Videos for a Plex Other Videos or Jellyfin/Emby Movies library, TV shows for a TV library.";
const HAS_FILES_CAPTION = "Holds downloaded videos, so its layout can't change yet.";
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
}

const LibraryFolderRow: React.FC<LibraryFolderRowProps> = ({ folder, disabled, onLayoutChange }) => {
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
      </Box>
      <Select
        size="small"
        value={folder.layout}
        disabled={disabled || folder.hasFiles}
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
export const LibraryFoldersList: React.FC<LibraryFoldersListProps> = ({ library }) => {
  const { folders, loading, error, refetch, setFolderLayout } = library;
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [confirmMainTv, setConfirmMainTv] = useState(false);

  const applyLayout = async (name: string, layout: LibraryLayout) => {
    setChanging(true);
    try {
      await setFolderLayout(name, layout);
      setChangeError(null);
    } catch (err: unknown) {
      setChangeError(err instanceof Error && err.message ? err.message : CHANGE_FAILED);
    } finally {
      setChanging(false);
    }
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
    </Box>
  );
};
