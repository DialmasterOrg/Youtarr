import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '../../ui';
import { useLibraryCheck } from '../../../hooks/useLibraryCheck';
import { plexMappingChoice } from '../../../utils/libraryAttention';
import { folderKey } from '../../../utils/libraryLayouts';
import { LibraryCheckNotes } from '../../shared/LibraryCheck/LibraryCheckNotes';

const PLEX_SETUP_NOTE =
  'Plex: add a TV Shows library for this folder (scanner Plex TV Series, agent Plex NFO Series or Plex Personal Media). '
  + 'Youtarr then maps the folder to it so new episodes refresh that library.';
const JELLYFIN_EMBY_SETUP_NOTE =
  'Jellyfin and Emby: add a Shows (Emby: TV Shows) library for this folder with NFO saving off and all metadata downloaders and image fetchers off; on Emby, keep the NFO metadata reader on.';

/** How to set up media server libraries for a TV folder, for setups the check can't read. */
export function MediaServerSetupNotes() {
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

export interface ChannelTvMediaServersProps {
  token: string | null;
  /** The TV library folder the channel's show lives in ('' = main folder) */
  folder: string;
}

/**
 * The library check for a TV channel's folder. When exactly one Plex TV
 * library holds a TV subfolder that has no refresh mapping yet, the mapping
 * is added right away.
 */
function ChannelTvMediaServers({ token, folder }: ChannelTvMediaServersProps) {
  const { data, loading, error, refetch, applyPlexMapping } = useLibraryCheck(token, { folders: [folder] });
  const [mappedName, setMappedName] = useState<string | null>(null);
  const attempted = useRef<string | null>(null);
  const report = data?.folders.find((entry) => folderKey(entry.name) === folderKey(folder)) ?? null;
  const plex = report?.servers.find((server) => server.serverType === 'plex');
  const suggestion = plex?.plexMapping?.suggestedLibraryId ?? null;
  const needsMapping = Boolean(report?.name && suggestion && plexMappingChoice(plex?.plexMapping) === 'none');

  useEffect(() => {
    if (!needsMapping || !report || !suggestion) return;
    const key = `${folderKey(report.name)}:${suggestion}`;
    if (attempted.current === key) return;
    attempted.current = key;
    const libraryName = plex?.libraries.find((library) => library.id === suggestion)?.name ?? null;
    // A failure leaves the issue with its own button.
    applyPlexMapping(report.name, suggestion).then(() => setMappedName(libraryName)).catch(() => undefined);
  }, [needsMapping, report, suggestion, plex, applyPlexMapping]);

  if (!data) {
    if (error) return <Alert severity="warning">{error}</Alert>;
    return loading ? (
      <Box className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircularProgress size={16} />
        <span>Checking media server libraries...</span>
      </Box>
    ) : null;
  }
  if (data.servers.length === 0 || !report) return <MediaServerSetupNotes />;

  return (
    <Box className="flex flex-col gap-2 rounded-[var(--radius-ui)] bg-muted p-3">
      <Box className="flex flex-wrap items-center justify-between gap-2">
        <Typography variant="body2" className="font-semibold">
          Media servers
        </Typography>
        <Button size="small" variant="text" loading={loading} onClick={() => { void refetch(); }}>
          Check again
        </Button>
      </Box>
      <LibraryCheckNotes folder={report} servers={data.servers} showSetupHints onApplyPlexMapping={applyPlexMapping} />
      {mappedName && (
        <Typography variant="caption" color="text.secondary">
          New episodes now refresh the Plex library {mappedName}.
        </Typography>
      )}
      {error && <Typography variant="caption" color="error">{error}</Typography>}
    </Box>
  );
}

export default ChannelTvMediaServers;
