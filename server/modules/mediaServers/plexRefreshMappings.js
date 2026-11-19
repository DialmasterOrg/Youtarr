/**
 * Which Plex library a library folder's downloads refresh, set from the
 * Library folders page: a library, the explicit default library (an entry
 * with libraryId null, which automatic mapping leaves alone), or no setting.
 * Removing a setting needs no Plex connection, so stale entries (Plex
 * offline, a deleted library) can always be cleared.
 */

const configModule = require('../configModule');
const plexModule = require('../plexModule');
const subfolderModule = require('../subfolderModule');
const logger = require('../../logger');
const { folderKey } = require('../tvShows/constants');
const { readMappings, findEntry, mappingOf, withEntry, withoutEntry } = require('./plexMappingEntries');

function refusal(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function view(mappings, folder) {
  const { choice, libraryId } = mappingOf(mappings, folder);
  return { mappedLibraryId: libraryId, choice, plexSubfolderLibraryMappings: mappings };
}

class PlexRefreshMappings {
  async _knownFolderName(folder) {
    if (!folder) return '';
    const names = (await subfolderModule.getAll()).map((display) => display.replace(/^__/, ''));
    const match = names.find((name) => folderKey(name) === folderKey(folder));
    if (match === undefined) throw refusal('Library folder not found', 404);
    return match;
  }

  async _assertPlexLists(libraryId) {
    const config = configModule.getConfig();
    if (!config.plexApiKey || !plexModule.getBaseUrl(config.plexIP, config, config.plexPort, config.plexViaHttps)) {
      throw refusal('Plex isn\'t configured.', 409);
    }
    // getLibraries answers [] when Plex can't be reached.
    const libraries = await plexModule.getLibraries();
    if (libraries.length === 0) throw refusal('Plex can\'t be reached, so the library can\'t be checked.', 409);
    if (!libraries.some((library) => String(library.id) === libraryId)) {
      throw refusal(`Plex doesn't list library ${libraryId}.`, 400);
    }
  }

  /**
   * @param {string} folder - '' for the main folder
   * @param {string|null} libraryId - a Plex library id, or null for the default library
   */
  async setMapping(folder, libraryId) {
    const name = await this._knownFolderName(folder);
    if (libraryId !== null) await this._assertPlexLists(libraryId);
    // A folder known only from config gets its registry row.
    if (name) await subfolderModule.register(name);
    const config = configModule.getConfig();
    const mappings = withEntry(readMappings(config), name, libraryId);
    configModule.updateConfig({ ...config, plexSubfolderLibraryMappings: mappings });
    logger.info({ libraryFolder: name, libraryId }, 'Set the Plex library a library folder refreshes');
    return view(mappings, name);
  }

  /** @param {string} folder - '' for the main folder */
  async removeMapping(folder) {
    const config = configModule.getConfig();
    const current = readMappings(config);
    if (!findEntry(current, folder)) return view(current, folder);
    const mappings = withoutEntry(current, folder);
    configModule.updateConfig({ ...config, plexSubfolderLibraryMappings: mappings });
    logger.info({ libraryFolder: folder }, 'Removed the Plex refresh setting of a library folder');
    return view(mappings, folder);
  }
}

module.exports = new PlexRefreshMappings();
