import type { LibraryFolder } from '../../../types/tvShows';
import { ServerStatus, folderState, needsLibrary } from '../../../utils/libraryAttention';

/** A server without a report, or one that is fine, unchecked or checking, shows as one line instead of a card. */
export function rendersAsLine(status: ServerStatus): boolean {
  return !status.report || status.display === 'fine' || status.display === 'unchecked' || status.display === 'checking';
}

/** The Plex refresh control belongs to folders that need a library, or that already have a mapping entry. */
export function showsPlexControl(folder: LibraryFolder): boolean {
  return needsLibrary(folderState(folder)) || (folder.plexMapping?.choice ?? 'none') !== 'none';
}
