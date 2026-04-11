import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { PlexConnectionStatus } from '../types';
import { PlexLibrary, resolveLibraryDisplay } from '../../../utils/plexLibraries';
import { PlexLibraryLabel } from './components/PlexLibraryLabel';

export interface PlexSubfolderMapping {
  subfolder: string | null;
  libraryId: string;
}

interface PlexSubfolderMappingsProps {
  mappings: PlexSubfolderMapping[];
  onMappingsChange: (mappings: PlexSubfolderMapping[]) => void;
  token: string | null;
  plexConnectionStatus: PlexConnectionStatus;
  plexLibraries: PlexLibrary[];
}

/**
 * Internal sentinel for the "Root folder" Select option.
 * Uses a long namespaced string that cannot collide with any real subfolder
 * value: the API returns subfolders with the `__` prefix convention, so a
 * channel would need sub_folder = 'ROOT_LIBRARY_MAPPING__' to collide here,
 * which is effectively impossible in practice.
 */
const ROOT_SELECT_VALUE = '__YOUTARR_ROOT_LIBRARY_MAPPING__';

/** Strip the __ filesystem prefix from a subfolder name returned by the API. */
const stripPrefix = (folder: string): string => folder.replace(/^__/, '');

/** Convert a Select value back to the stored mapping subfolder (null for root). */
const selectValueToSubfolder = (value: string): string | null =>
  value === ROOT_SELECT_VALUE ? null : stripPrefix(value);

/** Format a mapping's subfolder for display in the table. */
const formatMappingSubfolder = (subfolder: string | null): string =>
  subfolder ? `__${subfolder}` : 'Root folder';

export const PlexSubfolderMappings: React.FC<PlexSubfolderMappingsProps> = ({
  mappings,
  onMappingsChange,
  token,
  plexConnectionStatus,
  plexLibraries,
}) => {
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [newSubfolder, setNewSubfolder] = useState<string>('');
  const [newLibraryId, setNewLibraryId] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  const isConnected = plexConnectionStatus === 'connected';

  useEffect(() => {
    if (!isConnected) return;

    const controller = new AbortController();
    const { signal } = controller;
    const headers = { 'x-access-token': token || '' };

    setLoadingData(true);
    setFetchError(false);

    axios
      .get<unknown>('/api/channels/subfolders', { headers, signal })
      .then((res) => {
        if (signal.aborted) return;
        setSubfolders(Array.isArray(res.data) ? (res.data as string[]) : []);
      })
      .catch(() => {
        if (signal.aborted) return;
        setFetchError(true);
      })
      .finally(() => {
        if (!signal.aborted) setLoadingData(false);
      });

    return () => controller.abort();
  }, [isConnected, token]);

  const isMappingDuplicate = (subfolder: string | null): boolean =>
    mappings.some((m) => m.subfolder === subfolder);

  const handleAddMapping = () => {
    if (!newSubfolder || !newLibraryId) return;

    const subfolder = selectValueToSubfolder(newSubfolder);
    if (isMappingDuplicate(subfolder)) return;

    onMappingsChange([...mappings, { subfolder, libraryId: newLibraryId }]);
    setNewSubfolder('');
    setNewLibraryId('');
    setShowAddForm(false);
  };

  const handleDeleteMapping = (subfolder: string | null) => {
    onMappingsChange(mappings.filter((m) => m.subfolder !== subfolder));
  };

  const isAddDisabled =
    !newSubfolder ||
    !newLibraryId ||
    isMappingDuplicate(selectValueToSubfolder(newSubfolder));

  // When disconnected and no mappings exist yet, the whole section is unnecessary noise.
  // When disconnected but mappings exist, keep the table visible so users can delete entries.
  if (!isConnected && mappings.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2">
          Per-Subfolder Library Mappings
        </Typography>
        {!showAddForm && (
          <Tooltip title={!isConnected ? 'Connect to Plex to add new mappings' : ''}>
            <span>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setShowAddForm(true)}
                data-testid="add-mapping-button"
                disabled={loadingData || !isConnected}
              >
                Add Mapping
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Map each subfolder to a specific Plex library. Subfolders without a mapping use the
        default library selected above.
      </Typography>

      {loadingData && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Loading subfolders...
          </Typography>
        </Box>
      )}

      {fetchError && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Could not load channel subfolders. Check your connection and try refreshing.
        </Alert>
      )}

      {mappings.length > 0 && (
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Subfolder</TableCell>
              <TableCell>Plex Library</TableCell>
              <TableCell padding="checkbox" />
            </TableRow>
          </TableHead>
          <TableBody>
            {mappings.map((mapping) => {
              const display = resolveLibraryDisplay(plexLibraries, mapping.libraryId);
              return (
                <TableRow key={`${mapping.subfolder === null ? '\x00root' : mapping.subfolder}-${mapping.libraryId}`}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {formatMappingSubfolder(mapping.subfolder)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <PlexLibraryLabel display={display} />
                  </TableCell>
                  <TableCell padding="checkbox">
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteMapping(mapping.subfolder)}
                      aria-label={`Remove mapping for ${formatMappingSubfolder(mapping.subfolder)}`}
                      data-testid={`delete-mapping-${mapping.subfolder ?? 'root'}`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {mappings.length === 0 && !showAddForm && !loadingData && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          No per-subfolder mappings configured. All downloads will refresh the default library.
        </Typography>
      )}

      {showAddForm && isConnected && (
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap', mt: 1 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="new-mapping-subfolder-label">Subfolder</InputLabel>
            <Select
              labelId="new-mapping-subfolder-label"
              label="Subfolder"
              value={newSubfolder}
              onChange={(e: SelectChangeEvent) => setNewSubfolder(e.target.value)}
              data-testid="new-mapping-subfolder-select"
              disabled={loadingData}
            >
              <MenuItem value={ROOT_SELECT_VALUE}>Root folder</MenuItem>
              {subfolders.map((folder) => (
                <MenuItem
                  key={folder}
                  value={folder}
                  disabled={isMappingDuplicate(selectValueToSubfolder(folder))}
                >
                  {folder}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="new-mapping-library-label">Plex Library</InputLabel>
            <Select
              labelId="new-mapping-library-label"
              label="Plex Library"
              value={newLibraryId}
              onChange={(e: SelectChangeEvent) => setNewLibraryId(e.target.value)}
              data-testid="new-mapping-library-select"
              disabled={loadingData}
            >
              {plexLibraries.map((lib) => (
                <MenuItem key={lib.id} value={lib.id}>
                  {lib.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            size="small"
            onClick={handleAddMapping}
            disabled={isAddDisabled}
            data-testid="confirm-add-mapping-button"
            sx={{ height: 40 }}
          >
            Add
          </Button>
          <Button
            size="small"
            onClick={() => {
              setShowAddForm(false);
              setNewSubfolder('');
              setNewLibraryId('');
            }}
            sx={{ height: 40 }}
          >
            Cancel
          </Button>
        </Box>
      )}
    </Box>
  );
};
