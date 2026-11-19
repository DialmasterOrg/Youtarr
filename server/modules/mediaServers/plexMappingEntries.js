/**
 * The plexSubfolderLibraryMappings config list: which Plex library a library
 * folder's downloads refresh. An entry with a library id chooses that
 * library; an entry without one (libraryId null) is an explicit choice of the
 * default library, which automatic mapping leaves alone. The main folder's
 * entry has subfolder null. Folder names compare ignoring case.
 *
 * Pure: callers read and save the config.
 */

const { folderKey } = require('../tvShows/constants');

const CHOICE_LIBRARY = 'library';
const CHOICE_DEFAULT = 'default';
const CHOICE_NONE = 'none';

function readMappings(config) {
  const raw = config ? config.plexSubfolderLibraryMappings : null;
  return Array.isArray(raw) ? raw.filter((entry) => entry && typeof entry === 'object') : [];
}

function sameFolder(entry, folder) {
  return folderKey(entry.subfolder) === folderKey(folder);
}

function findEntry(mappings, folder) {
  return mappings.find((entry) => sameFolder(entry, folder)) || null;
}

function libraryIdOf(entry) {
  if (entry.libraryId === null || entry.libraryId === undefined) return null;
  const id = String(entry.libraryId).trim();
  return id || null;
}

/** @returns {{choice: string, libraryId: string|null}} */
function mappingOf(mappings, folder) {
  const entry = findEntry(mappings, folder);
  if (!entry) return { choice: CHOICE_NONE, libraryId: null };
  const libraryId = libraryIdOf(entry);
  return { choice: libraryId ? CHOICE_LIBRARY : CHOICE_DEFAULT, libraryId };
}

/** The list with the folder's entry set to libraryId (null = the default library). */
function withEntry(mappings, folder, libraryId) {
  const entry = { subfolder: folder || null, libraryId: libraryId === null ? null : String(libraryId) };
  const next = [];
  let placed = false;
  for (const existing of mappings) {
    if (!sameFolder(existing, folder)) {
      next.push(existing);
    } else if (!placed) {
      next.push(entry);
      placed = true;
    }
  }
  if (!placed) next.push(entry);
  return next;
}

function withoutEntry(mappings, folder) {
  return mappings.filter((entry) => !sameFolder(entry, folder));
}

module.exports = {
  CHOICE_LIBRARY,
  CHOICE_DEFAULT,
  CHOICE_NONE,
  readMappings,
  findEntry,
  mappingOf,
  withEntry,
  withoutEntry,
};
