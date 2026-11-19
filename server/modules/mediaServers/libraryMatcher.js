/**
 * Ties a media server's library locations to Youtarr's library folders.
 *
 * Server paths differ from Youtarr's (`Q:\Youtube_test\__TV Shows` on the
 * server, `/usr/src/app/data/__TV Shows` in the container), so a folder is
 * found on a server two ways:
 * - by name: a location ending in `__<subfolder>` is that subfolder, and its
 *   parent is the main folder;
 * - by content: a sampled item whose file Youtarr downloaded ([id] in its
 *   name) shows which server path holds which library folder, including a
 *   main folder whose name differs and a library mounted at the folder
 *   itself (`/tvshows` for `__TV Shows`).
 * Once the main folder's server path is known, each subfolder is assumed to
 * sit beneath it as `__<name>`.
 *
 * Pure: callers read the libraries, samples and Youtarr's files.
 */

const { folderKey } = require('../tvShows/constants');

const SUBFOLDER_PREFIX = '__';
const YOUTUBE_ID_IN_NAME = /\[([A-Za-z0-9_-]{11})\]\.[A-Za-z0-9]+$/;

const RELATION_EXACT = 'exact';
const RELATION_COVERS = 'covers';
const RELATION_INSIDE = 'inside';

const SOURCE_NAME = 'name';
const SOURCE_SAMPLE = 'sample';
const SOURCE_DERIVED = 'derived';

function segmentsOf(p) {
  return String(p || '').split(/[\\/]+/).filter(Boolean);
}

// How a server spells its paths: a POSIX leading slash or a UNC prefix, and
// its separator, so a path rebuilt from segments reads as the server shows it.
function pathStyleOf(original) {
  const text = String(original || '');
  const separator = text.includes('\\') && !text.includes('/') ? '\\' : '/';
  const root = text.startsWith('\\\\') ? '\\\\' : text.startsWith('/') ? '/' : '';
  return { separator, root };
}

function formatPath(segments, style) {
  return `${style.root}${segments.join(style.separator)}`;
}

function sameSegment(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

function isPrefix(prefix, segments) {
  return prefix.length <= segments.length && prefix.every((segment, i) => sameSegment(segment, segments[i]));
}

function pathKey(segments) {
  return segments.map((segment) => segment.toLowerCase()).join('/');
}

/** The YouTube id in a downloaded file's name, or null. */
function youtubeIdOf(filePath) {
  const base = segmentsOf(filePath).pop() || '';
  const match = YOUTUBE_ID_IN_NAME.exec(base);
  return match ? match[1] : null;
}

/** The library folder a subfolder segment names ('' for none). */
function subfolderOfSegment(segment, subfolderKeys) {
  if (!segment || !segment.startsWith(SUBFOLDER_PREFIX)) return null;
  const name = segment.slice(SUBFOLDER_PREFIX.length);
  return subfolderKeys.get(folderKey(name)) ?? null;
}

class FolderPaths {
  constructor() {
    this.byFolder = new Map(); // folderKey -> Map(pathKey -> { segments, source, style })
  }

  /**
   * @param {string} folder
   * @param {string[]} segments
   * @param {string} source
   * @param {{separator: string, root: string}} style - how the server spells the path (pathStyleOf)
   */
  add(folder, segments, source, style) {
    if (segments.length === 0) return;
    const key = folderKey(folder);
    if (!this.byFolder.has(key)) this.byFolder.set(key, new Map());
    const paths = this.byFolder.get(key);
    const existing = paths.get(pathKey(segments));
    // A path found by name or content outranks one only assumed.
    if (!existing || existing.source === SOURCE_DERIVED) paths.set(pathKey(segments), { segments, source, style });
  }

  of(folder) {
    return [...(this.byFolder.get(folderKey(folder))?.values() || [])];
  }
}

/**
 * Where a sampled server file and Youtarr's copy of it agree: the shared
 * tail below Youtarr's downloads folder. The rest of each path is the folder
 * that holds it on each side.
 */
function mappingFromSample({ serverPath, containerPath }, rootSegments, subfolderKeys) {
  const server = segmentsOf(serverPath);
  const container = segmentsOf(containerPath);
  if (!isPrefix(rootSegments, container)) return null;
  const below = container.length - rootSegments.length;
  let shared = 0;
  while (shared < below && shared < server.length
    && sameSegment(server[server.length - 1 - shared], container[container.length - 1 - shared])) {
    shared += 1;
  }
  // The file name at least, and one folder (the channel or show folder).
  if (shared < 2) return null;
  const containerPrefix = container.slice(0, container.length - shared);
  const serverPrefix = server.slice(0, server.length - shared);
  if (serverPrefix.length === 0) return null;
  const extra = containerPrefix.slice(rootSegments.length);
  const folder = extra.length === 0 ? '' : extra.length === 1 ? subfolderOfSegment(extra[0], subfolderKeys) : null;
  if (folder === null) return null;
  // The server still lists a copy in another of Youtarr's subfolders (a moved
  // video before the server rescans): it says nothing about this folder.
  const serverFolder = subfolderOfSegment(serverPrefix[serverPrefix.length - 1], subfolderKeys);
  if (serverFolder !== null && folderKey(serverFolder) !== folderKey(folder)) return null;
  return { folder, segments: serverPrefix, style: pathStyleOf(serverPath) };
}

/**
 * @param {Object} params
 * @param {string[]} params.folders - Youtarr's library folders ('' = main folder, else the subfolder name)
 * @param {Array<{id: string, locations: string[]}>} params.libraries - The server's libraries
 * @param {Array<{serverPath: string, containerPath: string}>} [params.samples] - Sampled server files
 *   paired with Youtarr's path of the same download
 * @param {string} params.containerRoot - Youtarr's downloads folder
 * @returns {{
 *   relations: Array<{libraryId: string, location: string, folder: string, relation: string, source: string,
 *     folderSegmentMissing: boolean}>,
 *   folderPaths: (folder: string) => Array<{path: string, source: string}>,  path in the server's own spelling
 *   mainKnown: boolean,
 *   scope: Set<string>|null
 * }}
 *   scope: ids of the libraries that may hold Youtarr's files, or null when
 *   the main folder can't be found on the server (then nothing can be ruled out)
 */
function matchLibraries({ folders, libraries, samples = [], containerRoot }) {
  const subfolderKeys = new Map();
  for (const folder of folders) {
    if (folder) subfolderKeys.set(folderKey(folder), folder);
  }
  const rootSegments = segmentsOf(containerRoot);
  const paths = new FolderPaths();

  for (const library of libraries) {
    for (const location of library.locations || []) {
      const segments = segmentsOf(location);
      const folder = subfolderOfSegment(segments[segments.length - 1], subfolderKeys);
      if (folder === null) continue;
      const style = pathStyleOf(location);
      paths.add(folder, segments, SOURCE_NAME, style);
      paths.add('', segments.slice(0, -1), SOURCE_NAME, style);
    }
  }
  for (const sample of samples) {
    const mapping = mappingFromSample(sample, rootSegments, subfolderKeys);
    if (mapping) paths.add(mapping.folder, mapping.segments, SOURCE_SAMPLE, mapping.style);
  }
  const mains = paths.of('');
  for (const folder of subfolderKeys.values()) {
    for (const main of mains) {
      paths.add(folder, [...main.segments, `${SUBFOLDER_PREFIX}${folder}`], SOURCE_DERIVED, main.style);
    }
  }

  const allFolders = ['', ...subfolderKeys.values()];
  const relations = [];
  for (const library of libraries) {
    for (const location of library.locations || []) {
      const segments = segmentsOf(location);
      for (const folder of allFolders) {
        for (const known of paths.of(folder)) {
          const relation = relationOf(segments, known.segments, folder);
          if (!relation) continue;
          relations.push({
            libraryId: String(library.id),
            location,
            folder,
            relation,
            source: known.source,
            folderSegmentMissing: relation === RELATION_EXACT && Boolean(folder)
              && !sameSegment(segments[segments.length - 1] || '', `${SUBFOLDER_PREFIX}${folder}`),
          });
        }
      }
    }
  }

  const mainKnown = mains.length > 0;
  const scope = mainKnown ? new Set(relations.map((relation) => relation.libraryId)) : null;
  return {
    relations: dedupeRelations(relations),
    folderPaths: (folder) => paths.of(folder).map((known) => ({ path: formatPath(known.segments, known.style), source: known.source })),
    mainKnown,
    scope,
  };
}

function relationOf(location, folderPath, folder) {
  if (location.length === folderPath.length && isPrefix(folderPath, location)) return RELATION_EXACT;
  if (location.length < folderPath.length && isPrefix(location, folderPath)) return RELATION_COVERS;
  if (location.length > folderPath.length && isPrefix(folderPath, location)) {
    // Inside the main folder's own content only: a library below a __subfolder belongs to that subfolder.
    if (!folder && location[folderPath.length].startsWith(SUBFOLDER_PREFIX)) return null;
    return RELATION_INSIDE;
  }
  return null;
}

// One relation of each kind per library, location and folder: the one found most directly.
function dedupeRelations(relations) {
  const rank = { [SOURCE_NAME]: 0, [SOURCE_SAMPLE]: 1, [SOURCE_DERIVED]: 2 };
  const kept = new Map();
  for (const relation of relations) {
    const key = JSON.stringify([
      relation.libraryId, relation.location.toLowerCase(), folderKey(relation.folder), relation.relation,
    ]);
    const existing = kept.get(key);
    if (!existing || rank[relation.source] < rank[existing.source]) kept.set(key, relation);
  }
  return [...kept.values()];
}

module.exports = {
  RELATION_EXACT,
  RELATION_COVERS,
  RELATION_INSIDE,
  SOURCE_NAME,
  SOURCE_SAMPLE,
  SOURCE_DERIVED,
  youtubeIdOf,
  segmentsOf,
  mappingFromSample,
  matchLibraries
};
