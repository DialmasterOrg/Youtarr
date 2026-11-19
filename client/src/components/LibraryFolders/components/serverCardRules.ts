import type { LibraryFolder } from '../../../types/tvShows';
import { ServerStatus, folderState, listedIssues, needsLibrary } from '../../../utils/libraryAttention';

/** A server without a report, or one that is fine, unchecked or checking, shows as one line instead of a card. */
export function rendersAsLine(status: ServerStatus): boolean {
  return !status.report || status.display === 'fine' || status.display === 'unchecked' || status.display === 'checking';
}

/** A server with nothing to fix takes one line in the inspector's server box; problems keep a card. */
export function rendersAsRow(status: ServerStatus): boolean {
  if (rendersAsLine(status)) return true;
  return status.display === 'ok' && status.report !== null && listedIssues(status.report).length === 0;
}

/** The Plex refresh control belongs to folders that need a library, or that already have a mapping entry. */
export function showsPlexControl(folder: LibraryFolder): boolean {
  return needsLibrary(folderState(folder)) || (folder.plexMapping?.choice ?? 'none') !== 'none';
}
