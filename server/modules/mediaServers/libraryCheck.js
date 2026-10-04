/**
 * The library check (GET /api/library-folders/check): for each library
 * folder and each configured media server, whether a library of the right
 * kind holds the folder, and what in that library's setup works against
 * Youtarr's files (wrong type, an agent that matches unrelated shows, a
 * server rewriting Youtarr's NFO files, another library showing the same
 * files again).
 *
 * Also adds a TV folder's Plex refresh mapping when exactly one Plex TV
 * library holds it (applyPlexMapping).
 */

const configModule = require('../configModule');
const logger = require('../../logger');
const libraryFolders = require('../tvShows/libraryFolders');
const { LAYOUT_TV, folderKey } = require('../tvShows/constants');
const serverRegistry = require('./serverRegistry');
const libraryLocator = require('./libraryLocator');
const { LIBRARY_TYPES, describeHttpError } = require('./adapters/baseAdapter');
const { RELATION_EXACT, RELATION_COVERS, RELATION_INSIDE } = require('./libraryMatcher');

const SERVER_NAMES = { plex: 'Plex', jellyfin: 'Jellyfin', emby: 'Emby' };
const TYPE_NAMES = {
  plex: { videos: 'Movies or Other Videos', tv: 'TV Shows', music: 'Music' },
  jellyfin: { videos: 'Movies or Home Videos', tv: 'Shows', mixed: 'Mixed Movies and Shows', music: 'Music' },
  emby: { videos: 'Movies or Home Videos', tv: 'TV Shows', mixed: 'Mixed Content', music: 'Music' },
};
// Libraries that show video files; photo and other libraries don't matter here.
const VIDEO_LIBRARY_TYPES = new Set([LIBRARY_TYPES.VIDEOS, LIBRARY_TYPES.TV, LIBRARY_TYPES.MIXED]);
// A Videos folder of MP3 channels is served by a music library pointed at it.
// One at a parent folder only says where the MP3s go, nothing about the videos.
const VIDEOS_FOLDER_EXACT_LIBRARY_TYPES = new Set([...VIDEO_LIBRARY_TYPES, LIBRARY_TYPES.MUSIC]);

const PLEX_SERIES_AGENT = 'tv.plex.agents.series';
const PLEX_LEGACY_AGENT_PREFIX = 'com.plexapp.agents.';
const PLEX_TV_SCANNER = 'Plex TV Series';

const STATUS = Object.freeze({ OK: 'ok', WARNING: 'warning', MISSING: 'missing', UNREACHABLE: 'unreachable' });
// Jellyfin and Emby show a folder in one library only: a library whose
// folder sits inside another library's folder is skipped (Jellyfin logs
// "Found duplicate path"), so a root library leaves a TV library inside it empty.
const ONE_LIBRARY_PER_FOLDER = new Set(['jellyfin', 'emby']);

function folderLabel(name) {
  return name ? `__${name}` : 'the main folder';
}

function typeName(serverType, type) {
  return TYPE_NAMES[serverType]?.[type] || type;
}

function libraryView(library, relation) {
  return {
    id: library.id,
    name: library.name,
    type: library.type,
    location: relation.location,
    relation: relation.relation,
  };
}

class LibraryCheck {
  /**
   * @param {Object} [options]
   * @param {string[]} [options.folders] - Only report these library folders ('' = main folder)
   * @param {string} [options.layout] - Check the folders asked for as this layout instead of their
   *   saved one (a reorganize preview checks the folders videos are about to move into)
   * @returns {Promise<{servers: Array<Object>, folders: Array<Object>}>}
   */
  async check({ folders: onlyFolders, layout: asLayout } = {}) {
    const config = configModule.getConfig();
    const adapters = serverRegistry.getEnabledAdapters(config);
    const wanted = onlyFolders ? new Set(onlyFolders.map(folderKey)) : null;
    const folders = (await libraryFolders.listLibraryFolders()).map((folder) => (
      asLayout && wanted?.has(folderKey(folder.name)) ? { ...folder, layout: asLayout } : folder
    ));
    const names = folders.map((folder) => folder.name);
    const servers = await Promise.all(adapters.map(async (adapter) => {
      try {
        return { adapter, ...await libraryLocator.locate(adapter, names) };
      } catch (err) {
        logger.warn({ ...describeHttpError(err), serverType: adapter.serverType }, 'Library check could not read a media server');
        return { adapter, error: describeHttpError(err).message };
      }
    }));
    const mainFolder = folders.find((folder) => !folder.name);
    return {
      servers: servers.map((server) => ({
        serverType: server.adapter.serverType,
        name: SERVER_NAMES[server.adapter.serverType] || server.adapter.serverType,
        reachable: !server.error,
        error: server.error || null,
      })),
      folders: folders
        .filter((folder) => !wanted || wanted.has(folderKey(folder.name)))
        .map((folder) => ({
          name: folder.name,
          layout: folder.layout,
          hasFiles: folder.hasFiles,
          channels: folder.channels,
          servers: servers.map((server) => this._report(folder, server, { config, mainLayout: mainFolder?.layout })),
        })),
    };
  }

  _report(folder, server, { config, mainLayout }) {
    const serverType = server.adapter.serverType;
    const serverName = SERVER_NAMES[serverType] || serverType;
    if (server.error) {
      return {
        serverType,
        status: STATUS.UNREACHABLE,
        libraries: [],
        issues: [{ code: 'unreachable', message: `Couldn't read ${serverName}'s libraries: ${server.error}` }],
      };
    }
    const byId = new Map(server.libraries.map((library) => [library.id, library]));
    const relationsOf = (kind, types = VIDEO_LIBRARY_TYPES) => server.match.relations
      .filter((relation) => relation.relation === kind && folderKey(relation.folder) === folderKey(folder.name))
      .filter((relation) => types.has(byId.get(relation.libraryId)?.type));
    const exact = relationsOf(RELATION_EXACT, folder.layout === LAYOUT_TV ? VIDEO_LIBRARY_TYPES : VIDEOS_FOLDER_EXACT_LIBRARY_TYPES);
    const exactIds = new Set(exact.map((relation) => relation.libraryId));
    const covering = relationsOf(RELATION_COVERS).filter((relation) => !exactIds.has(relation.libraryId));
    const inside = relationsOf(RELATION_INSIDE).filter((relation) => !exactIds.has(relation.libraryId));
    const isMainFolderLibrary = (libraryId) => server.match.relations.some((relation) => relation.libraryId === libraryId
      && relation.relation === RELATION_EXACT && !relation.folder);

    const context = { folder, serverType, serverName, byId, mainLayout, isMainFolderLibrary };
    const issues = folder.layout === LAYOUT_TV
      ? this._tvIssues(exact, covering, inside, context)
      : this._videoIssues(exact, covering, context);
    const libraries = [...exact, ...covering, ...(folder.layout === LAYOUT_TV ? inside : [])]
      .map((relation) => libraryView(byId.get(relation.libraryId), relation));

    const report = { serverType, status: STATUS.OK, libraries, issues };
    if (serverType === 'plex' && folder.layout === LAYOUT_TV && folder.name) {
      report.plexMapping = this._plexMapping(folder, exact, byId, config);
      const mappingIssue = this._plexMappingIssue(folder, report.plexMapping, byId, config);
      if (mappingIssue) issues.push(mappingIssue);
    }
    const holdsFolder = folder.layout === LAYOUT_TV
      ? exact.length > 0 && !(ONE_LIBRARY_PER_FOLDER.has(serverType) && covering.length > 0)
      : exact.length > 0 || covering.length > 0;
    if (!holdsFolder) report.status = STATUS.MISSING;
    else if (issues.length > 0) report.status = STATUS.WARNING;
    return report;
  }

  _tvIssues(exact, covering, inside, { folder, serverType, serverName, byId, mainLayout, isMainFolderLibrary }) {
    const issues = [];
    const label = folderLabel(folder.name);
    const tvName = typeName(serverType, LIBRARY_TYPES.TV);
    if (exact.length === 0) {
      issues.push({ code: 'noLibrary', message: `No ${serverName} ${tvName} library holds ${label}.` });
    }
    const exactTv = exact.filter((relation) => byId.get(relation.libraryId).type === LIBRARY_TYPES.TV);
    const exactTvLocations = new Set(exactTv.map((relation) => relation.location.toLowerCase()));
    if (exactTvLocations.size > 1) {
      const names = [...new Set(exactTv.map((relation) => byId.get(relation.libraryId).name))].join(', ');
      issues.push({ code: 'ambiguous', message: `More than one ${serverName} library seems to hold ${label} (${names}), from different folders on the server.` });
    }
    issues.push(...this._duplicateIssues(exact, { label, serverType, serverName, byId }));
    for (const relation of exact) {
      const library = byId.get(relation.libraryId);
      if (library.type !== LIBRARY_TYPES.TV) {
        issues.push({
          code: 'wrongType',
          libraryId: library.id,
          message: `${library.name} is a ${typeName(serverType, library.type)} library. A TV folder needs a ${tvName} library.`,
        });
        continue;
      }
      issues.push(...this._tvLibraryIssues(library, serverType));
      if (relation.folderSegmentMissing) {
        issues.push({
          code: 'folderNameMissing',
          libraryId: library.id,
          message: `${library.name} points at ${relation.location}, which is ${label} under another name. Watch state `
            + 'restored after a show moves between two TV folders can\'t tell the old copy from the new one there; those '
            + 'restores wait 14 days, then Retry pushes them. Mount the downloads folder (or keep the folder name) to avoid this.',
        });
      }
    }
    for (const relation of covering) {
      const library = byId.get(relation.libraryId);
      // Youtarr's .plexignore in a TV main folder hides the __ subfolders from a Plex library there.
      if (serverType === 'plex' && library.type === LIBRARY_TYPES.TV && mainLayout === LAYOUT_TV
        && isMainFolderLibrary(library.id)) continue;
      if (ONE_LIBRARY_PER_FOLDER.has(serverType)) {
        issues.push({
          code: 'nestedLibrary',
          libraryId: library.id,
          message: `${library.name} (at ${relation.location}) includes ${label}. ${serverName} shows a folder in only one `
            + `library, so ${label}'s episodes appear in ${library.name} and ${exact.length > 0 ? 'the TV library for it stays empty' : 'a TV library for it would stay empty'}. `
            + `Point ${library.name} at its own folders instead of a folder that contains ${label}.`,
        });
        continue;
      }
      issues.push(library.type === LIBRARY_TYPES.TV
        ? {
          code: 'overlapTv',
          libraryId: library.id,
          message: `${library.name} (at ${relation.location}) also includes ${label}, one level too high: it shows ${label} itself as a show.`,
        }
        : {
          code: 'overlap',
          libraryId: library.id,
          message: `${library.name} (at ${relation.location}) also includes ${label}, so its episodes show up there a second time.`,
        });
    }
    for (const relation of inside) {
      const library = byId.get(relation.libraryId);
      issues.push({
        code: 'insideFolder',
        libraryId: library.id,
        message: `${library.name} points at ${relation.location}, a folder inside ${label}. Point it at ${label} itself: each show folder must sit directly in the library's folder.`,
      });
    }
    return issues;
  }

  // Several TV libraries pointed at the same folder: each holds every episode
  // (on Plex), and watch state is restored to only one of the copies.
  _duplicateIssues(exact, { label, serverType, serverName, byId }) {
    const byLocation = new Map();
    for (const relation of exact) {
      if (byId.get(relation.libraryId).type !== LIBRARY_TYPES.TV) continue;
      const key = relation.location.toLowerCase();
      if (!byLocation.has(key)) byLocation.set(key, new Set());
      byLocation.get(key).add(relation.libraryId);
    }
    return [...byLocation.values()].filter((ids) => ids.size > 1).map((ids) => {
      const names = [...ids].map((id) => byId.get(id).name).join(', ');
      const shown = ONE_LIBRARY_PER_FOLDER.has(serverType)
        ? `${serverName} shows the folder in only one of them`
        : 'each shows every episode';
      return {
        code: 'duplicateLibrary',
        message: `${names} all point at ${label}. Keep one: ${shown}, and Youtarr restores watch state to only one copy.`,
      };
    });
  }

  _tvLibraryIssues(library, serverType) {
    const issues = [];
    if (serverType === 'plex') {
      if (library.agent === PLEX_SERIES_AGENT) {
        issues.push({
          code: 'plexSeriesAgent',
          libraryId: library.id,
          message: `${library.name} uses the Plex Series agent, which can match a channel to an unrelated TV show online. `
            + 'Use Plex Personal Media or Plex NFO Series.',
        });
      } else if ((library.agent || '').startsWith(PLEX_LEGACY_AGENT_PREFIX) || (library.scanner && library.scanner !== PLEX_TV_SCANNER)) {
        issues.push({
          code: 'plexLegacyAgent',
          libraryId: library.id,
          message: `${library.name} uses a legacy agent or scanner, which Plex is removing. Use the ${PLEX_TV_SCANNER} scanner `
            + 'with Plex Personal Media or Plex NFO Series.',
        });
      }
      return issues;
    }
    if (library.nfoSaver === true) issues.push(this._nfoSaverIssue(library));
    if (library.onlineFetchers === true) {
      issues.push({
        code: 'onlineFetchers',
        libraryId: library.id,
        message: `${library.name} looks shows and episodes up online, which can replace Youtarr's titles and numbers `
          + 'with an unrelated show\'s. Turn off the online metadata downloaders for shows and episodes.',
      });
    }
    return issues;
  }

  _nfoSaverIssue(library) {
    return {
      code: 'nfoSaver',
      libraryId: library.id,
      message: `${library.name} saves NFO files, so the server rewrites the NFO files Youtarr writes. Turn off the NFO metadata saver for this library.`,
    };
  }

  _videoIssues(exact, covering, { folder, serverType, byId, mainLayout, isMainFolderLibrary }) {
    const issues = [];
    const label = folderLabel(folder.name);
    for (const relation of exact) {
      const library = byId.get(relation.libraryId);
      if (library.type === LIBRARY_TYPES.TV) {
        issues.push({
          code: 'wrongType',
          libraryId: library.id,
          message: `${library.name} is a ${typeName(serverType, library.type)} library, but ${label} uses the Videos layout.`,
        });
      }
    }
    for (const relation of covering) {
      const library = byId.get(relation.libraryId);
      if (library.type !== LIBRARY_TYPES.TV) continue;
      if (serverType === 'plex' && mainLayout === LAYOUT_TV && isMainFolderLibrary(library.id)) continue;
      issues.push({
        code: 'overlapTv',
        libraryId: library.id,
        message: `${library.name} (a ${typeName(serverType, library.type)} library at ${relation.location}) also includes `
          + `${label}, where its channels show up as extra shows.`,
      });
    }
    // Youtarr writes no music NFO files, so a music library's saver is no concern.
    const savers = [...exact, ...covering]
      .map((relation) => byId.get(relation.libraryId))
      .filter((library) => library.nfoSaver === true && library.type !== LIBRARY_TYPES.MUSIC);
    for (const library of new Map(savers.map((entry) => [entry.id, entry])).values()) {
      issues.push(this._nfoSaverIssue(library));
    }
    return issues;
  }

  _mappedLibraryId(folder, config) {
    const mappings = Array.isArray(config.plexSubfolderLibraryMappings) ? config.plexSubfolderLibraryMappings : [];
    const mapping = mappings.find((entry) => entry && typeof entry === 'object'
      && entry.subfolder && folderKey(entry.subfolder) === folderKey(folder.name));
    return mapping?.libraryId ? String(mapping.libraryId) : null;
  }

  _plexMapping(folder, exact, byId, config) {
    const tvLibraries = [...new Set(exact
      .filter((relation) => byId.get(relation.libraryId).type === LIBRARY_TYPES.TV)
      .map((relation) => relation.libraryId))];
    return {
      mappedLibraryId: this._mappedLibraryId(folder, config),
      suggestedLibraryId: tvLibraries.length === 1 ? tvLibraries[0] : null,
    };
  }

  _plexMappingIssue(folder, { mappedLibraryId, suggestedLibraryId }, byId, config) {
    if (!suggestedLibraryId || mappedLibraryId === suggestedLibraryId) return null;
    const suggested = byId.get(suggestedLibraryId);
    if (mappedLibraryId) {
      const mapped = byId.get(mappedLibraryId);
      return {
        code: 'plexMappingMismatch',
        libraryId: suggestedLibraryId,
        message: `New episodes in ${folderLabel(folder.name)} refresh ${mapped ? mapped.name : `library ${mappedLibraryId}`}, `
          + `not ${suggested.name}. Change the subfolder mapping in Settings > Plex.`,
      };
    }
    const fallback = config.plexYoutubeLibraryId ? byId.get(String(config.plexYoutubeLibraryId)) : null;
    return {
      code: 'plexMappingMissing',
      libraryId: suggestedLibraryId,
      message: `New episodes in ${folderLabel(folder.name)} don't refresh ${suggested.name}`
        + `${fallback ? `: Youtarr refreshes ${fallback.name} instead` : ''}.`,
    };
  }

  /**
   * Map a TV subfolder to the one Plex TV library that holds it, so new
   * episodes refresh that library. Never replaces an existing mapping.
   * @param {string} folder - Subfolder name without __
   * @param {string} libraryId
   * @returns {Promise<{mappedLibraryId: string, plexSubfolderLibraryMappings: Array<Object>}>}
   *   with the saved mappings, so the client can take the change into its
   *   copy of the config without reloading it
   */
  async applyPlexMapping(folder, libraryId) {
    const result = await this.check({ folders: [folder] });
    const entry = result.folders[0];
    const plex = entry?.servers.find((server) => server.serverType === 'plex');
    if (!entry || !entry.name) throw this._error('Choose a TV subfolder to map.', 400);
    if (!plex || plex.status === STATUS.UNREACHABLE) throw this._error('Plex isn\'t configured or can\'t be reached.', 409);
    if (entry.layout !== LAYOUT_TV) throw this._error(`${folderLabel(entry.name)} isn't a TV folder.`, 400);
    const { mappedLibraryId, suggestedLibraryId } = plex.plexMapping;
    const config = configModule.getConfig();
    const mappings = Array.isArray(config.plexSubfolderLibraryMappings) ? config.plexSubfolderLibraryMappings : [];
    if (mappedLibraryId === String(libraryId)) return { mappedLibraryId, plexSubfolderLibraryMappings: mappings };
    if (mappedLibraryId) throw this._error(`${folderLabel(entry.name)} already refreshes another Plex library. Change it in Settings > Plex.`, 409);
    if (suggestedLibraryId !== String(libraryId)) {
      throw this._error(`That Plex library isn't the one TV Shows library that holds ${folderLabel(entry.name)}.`, 409);
    }
    const plexSubfolderLibraryMappings = [...mappings, { subfolder: entry.name, libraryId: String(libraryId) }];
    configModule.updateConfig({ ...config, plexSubfolderLibraryMappings });
    logger.info({ libraryFolder: entry.name, libraryId }, 'Mapped a TV folder to its Plex library for refreshes');
    return { mappedLibraryId: String(libraryId), plexSubfolderLibraryMappings };
  }

  _error(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
  }
}

module.exports = new LibraryCheck();
module.exports.STATUS = STATUS;
