/**
 * Finds Youtarr's library folders among one media server's libraries: lists
 * the libraries, samples a few files from each, pairs the samples with the
 * downloads they are, and hands everything to libraryMatcher.
 *
 * scopeFor() is the cheap form for listings: the ids of the libraries that
 * may hold Youtarr's files, or null when that can't be told (list everything).
 */

const configModule = require('../configModule');
const subfolderModule = require('../subfolderModule');
const logger = require('../../logger');
const { Video } = require('../../models');
const { LIBRARY_TYPES, describeHttpError } = require('./adapters/baseAdapter');
const { matchLibraries, mappingFromSample, youtubeIdOf, segmentsOf } = require('./libraryMatcher');
const { folderKey } = require('../tvShows/constants');

// Files sampled per library: enough to land on a download in a library that
// mostly holds Youtarr's, few enough to stay one small request.
const SAMPLE_SIZE = 10;
const SUBFOLDER_PREFIX = /^__/;

class LibraryLocator {
  /** Youtarr's library folders: '' for the main folder, then every subfolder. */
  async folderNames() {
    const subfolders = await subfolderModule.getAll();
    return ['', ...subfolders.map((display) => display.replace(SUBFOLDER_PREFIX, ''))];
  }

  async _pairSamples(serverPaths, folders) {
    const ids = [...new Set(serverPaths.map(youtubeIdOf).filter(Boolean))];
    if (ids.length === 0) return [];
    const videos = await Video.findAll({ where: { youtubeId: ids }, attributes: ['youtubeId', 'filePath', 'audioFilePath'] });
    const byId = new Map(videos.map((video) => [video.youtubeId, video]));
    const subfolderKeys = new Map(folders.filter(Boolean).map((folder) => [folderKey(folder), folder]));
    const rootSegments = segmentsOf(configModule.directoryPath);
    const samples = [];
    for (const serverPath of serverPaths) {
      const video = byId.get(youtubeIdOf(serverPath));
      if (!video) continue;
      // The copy with the same file name (a video and its MP3 share an id).
      const containerPath = [video.filePath, video.audioFilePath]
        .find((candidate) => candidate && mappingFromSample({ serverPath, containerPath: candidate }, rootSegments, subfolderKeys));
      if (containerPath) samples.push({ serverPath, containerPath });
    }
    return samples;
  }

  /**
   * @param {Object} adapter - A media server adapter
   * @param {string[]} [folders] - Library folder names; read from the registry when omitted
   * @returns {Promise<{libraries: Array<Object>, match: Object, scope: Set<string>|null}>}
   *   libraryMatcher's result as match; scope is its scope widened by the
   *   libraries whose sample said nothing about their content
   */
  async locate(adapter, folders) {
    const names = folders || await this.folderNames();
    const libraries = await adapter.listLibraries();
    const serverPaths = [];
    const inconclusive = [];
    for (const library of libraries) {
      if (library.type === LIBRARY_TYPES.OTHER) continue;
      const sampled = await adapter.sampleItemPaths(library, SAMPLE_SIZE);
      // An empty or unreadable library, or one holding YouTube downloads Youtarr
      // can't place, may still be one of Youtarr's: only a library whose files
      // are plainly something else is ruled out by its sample.
      if (sampled.length === 0 || sampled.some((serverPath) => youtubeIdOf(serverPath))) inconclusive.push(String(library.id));
      serverPaths.push(...sampled);
    }
    const samples = await this._pairSamples(serverPaths, names);
    const match = matchLibraries({ folders: names, libraries, samples, containerRoot: configModule.directoryPath });
    return {
      libraries,
      match,
      scope: match.scope ? new Set([...match.scope, ...inconclusive]) : null,
    };
  }

  /**
   * The libraries of a server that may hold Youtarr's files, for listings
   * that would otherwise read every library. Null (no limit) when the main
   * folder can't be found on the server or the server can't be read.
   * @param {Object} adapter
   * @returns {Promise<Set<string>|null>}
   */
  async scopeFor(adapter) {
    try {
      const { scope } = await this.locate(adapter);
      return scope;
    } catch (err) {
      logger.debug({ ...describeHttpError(err), serverType: adapter.serverType },
        'Could not find Youtarr\'s libraries on a media server; listing every library');
      return null;
    }
  }
}

module.exports = new LibraryLocator();
module.exports.SAMPLE_SIZE = SAMPLE_SIZE;
