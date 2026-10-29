import React, { useState } from 'react';
import { Box, Button, Typography } from '../../ui';
import { CheckCircle, Info, Warning, XCircle } from '../../../lib/icons';
import {
  LibraryCheckFolder, LibraryCheckServer, LibraryCheckServerReport, MediaServerType,
} from '../../../types/libraryCheck';

const MAPPING_ISSUE = 'plexMappingMissing';
const MAPPING_FAILED_MESSAGE = 'Could not save the Plex library mapping.';

function folderLabel(name: string): string {
  return name ? `__${name}` : 'the main folder';
}

/** How to add a TV library for a folder, per server. */
export function tvSetupHint(serverType: MediaServerType, folder: string): string {
  const label = folderLabel(folder);
  switch (serverType) {
    case 'plex':
      return `Add a TV Shows library for ${label}: scanner Plex TV Series, agent Plex NFO Series (or Plex Personal Media), `
        + 'with local assets on.';
    case 'jellyfin':
      return `Add a Shows library for ${label} with NFO saving off and all metadata downloaders and image fetchers off.`;
    default:
      return `Add a TV Shows library for ${label} with the NFO metadata reader on, NFO saving off and all metadata downloaders and image fetchers off.`;
  }
}

function summaryOf(report: LibraryCheckServerReport, layout: LibraryCheckFolder['layout']): string {
  if (report.status === 'unreachable') return "couldn't be checked";
  if (report.status === 'missing') return layout === 'tv' ? 'no TV library holds this folder' : 'not in a library';
  const names = [...new Set(report.libraries.filter((library) => library.relation !== 'inside').map((library) => library.name))];
  return names.join(', ');
}

function StatusIcon({ status }: { status: LibraryCheckServerReport['status'] }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0';
  if (status === 'ok') return <CheckCircle aria-hidden className={`${className} text-success`} />;
  if (status === 'unreachable') return <XCircle aria-hidden className={`${className} text-destructive`} />;
  if (status === 'missing') return <Info aria-hidden className={`${className} text-muted-foreground`} />;
  return <Warning aria-hidden className={`${className} text-warning`} />;
}

export interface LibraryCheckNotesProps {
  folder: LibraryCheckFolder;
  servers: LibraryCheckServer[];
  /** Tell how to add a TV library on servers that have none (TV folder setup) */
  showSetupHints?: boolean;
  /** Offer to map a TV folder to the Plex library that holds it, so new episodes refresh it */
  onApplyPlexMapping?: (folder: string, libraryId: string) => Promise<void>;
  /** Leave out servers where all is well */
  problemsOnly?: boolean;
}

/** What each media server's libraries do with one library folder. */
export function LibraryCheckNotes({
  folder, servers, showSetupHints = false, onApplyPlexMapping, problemsOnly = false,
}: LibraryCheckNotesProps) {
  const [mapping, setMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const nameOf = (serverType: MediaServerType) => servers.find((server) => server.serverType === serverType)?.name ?? serverType;
  const reports = folder.servers.filter((report) => !problemsOnly || report.status !== 'ok');
  if (reports.length === 0) return null;

  const mapFolder = async (libraryId: string) => {
    if (!onApplyPlexMapping) return;
    setMapping(true);
    setMappingError(null);
    try {
      await onApplyPlexMapping(folder.name, libraryId);
    } catch (err: unknown) {
      setMappingError(err instanceof Error && err.message ? err.message : MAPPING_FAILED_MESSAGE);
    } finally {
      setMapping(false);
    }
  };

  return (
    <Box component="ul" aria-label={`Media server libraries for ${folderLabel(folder.name)}`} className="m-0 flex list-none flex-col gap-1.5 p-0">
      {reports.map((report) => (
        <li key={report.serverType} className="flex gap-2">
          <StatusIcon status={report.status} />
          <Box className="min-w-0">
            <Typography variant="body2" className="break-words">
              <span className="font-medium">{nameOf(report.serverType)}:</span> {summaryOf(report, folder.layout)}
            </Typography>
            {report.issues.filter((issue) => issue.code !== 'noLibrary').map((issue, index) => (
              <Box key={`${issue.code}-${issue.libraryId ?? index}`} className="flex flex-wrap items-center gap-2">
                <Typography variant="caption" color="text.secondary" className="break-words">{issue.message}</Typography>
                {issue.code === MAPPING_ISSUE && issue.libraryId && onApplyPlexMapping && (
                  <Button size="small" variant="outlined" loading={mapping} onClick={() => { void mapFolder(issue.libraryId as string); }}>
                    Refresh this library
                  </Button>
                )}
              </Box>
            ))}
            {report.status === 'missing' && folder.layout === 'tv' && showSetupHints && (
              <Typography variant="caption" color="text.secondary" className="block">
                {tvSetupHint(report.serverType, folder.name)}
              </Typography>
            )}
            {report.serverType === 'plex' && mappingError && (
              <Typography variant="caption" color="error" className="block">{mappingError}</Typography>
            )}
          </Box>
        </li>
      ))}
    </Box>
  );
}

export default LibraryCheckNotes;
