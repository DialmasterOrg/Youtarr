/**
 * Shared types and helpers for working with the Plex library list
 * returned from GET /getplexlibraries.
 */

export interface PlexLibrary {
  id: string;
  title: string;
}

/**
 * Discriminated display shape for rendering a Plex library id in the UI.
 *
 * - `resolved`: the id matched an entry in the library list, so callers can
 *   show the title prominently and optionally append `(id: X)` without fear
 *   of duplicating the id.
 * - `id-fallback`: the library list is empty (disconnected, or not yet
 *   fetched) so the raw id is the primary display and must not be decorated
 *   with an additional "(id: X)" suffix.
 * - `id-only`: the list is populated but no entry matches, meaning the saved
 *   id refers to a library Plex no longer exposes. Same guidance: raw id is
 *   the only thing to show.
 */
export type PlexLibraryDisplay =
  | { kind: 'resolved'; title: string; id: string }
  | { kind: 'id-fallback'; id: string }
  | { kind: 'id-only'; id: string };

/**
 * Classify how a library id should be rendered given the current list.
 */
export function resolveLibraryDisplay(
  libraries: PlexLibrary[],
  libraryId: string
): PlexLibraryDisplay {
  const lib = libraries.find((l) => l.id === libraryId);
  if (lib) {
    return { kind: 'resolved', title: lib.title, id: libraryId };
  }
  if (libraries.length === 0) {
    return { kind: 'id-fallback', id: libraryId };
  }
  return { kind: 'id-only', id: libraryId };
}
