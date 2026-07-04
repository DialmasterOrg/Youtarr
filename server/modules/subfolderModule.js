const path = require('path');
const logger = require('../logger');
const Subfolder = require('../models/subfolder');
const Channel = require('../models/channel');
const Playlist = require('../models/playlist');
const configModule = require('./configModule');
const { buildSubfolderSegment, directoryHasFiles, removeIfEmpty } = require('./filesystem');
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } = require('./filesystem/constants');

const SENTINELS = new Set([GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL]);

function isRealName(value) {
  return typeof value === 'string' && value.trim() !== '' && !SENTINELS.has(value.trim());
}

function makeError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Single rule for why a subfolder can't be deleted, shared by delete() and
 * getUsage() so they can't drift.
 * @param {{channels:number, playlists:number, isDefault:boolean, plexMapped:boolean, hasFiles:boolean}} usage
 * @returns {string|null} reason, or null when the subfolder is safe to delete
 */
function deletionBlockReason(usage) {
  if (usage.channels > 0) {
    return `Subfolder is in use by ${usage.channels} channel(s)`;
  }
  if (usage.playlists > 0) {
    return `Subfolder is in use by ${usage.playlists} playlist(s)`;
  }
  if (usage.isDefault) {
    return 'Subfolder is the global default and cannot be deleted';
  }
  if (usage.plexMapped) {
    return 'Subfolder is mapped to a Plex library and cannot be deleted';
  }
  if (usage.hasFiles) {
    return 'Subfolder still contains downloaded files and cannot be deleted';
  }
  return null;
}

class SubfolderModule {
  /**
   * Names currently mapped to a Plex library (clean, non-null only).
   * @returns {string[]}
   */
  _plexMappingSubfolders() {
    const raw = configModule.getConfig().plexSubfolderLibraryMappings;
    const mappings = Array.isArray(raw) ? raw : [];
    return mappings
      .filter((m) => m && typeof m === 'object' && isRealName(m.subfolder))
      .map((m) => m.subfolder.trim());
  }

  /**
   * Deduped union of the registry, the config default, and Plex mappings.
   * @returns {Promise<string[]>} __-prefixed, sorted
   */
  async getAll() {
    const rows = await Subfolder.findAll({ attributes: ['name'] });

    const byKey = new Map(); // lowercased -> original
    const add = (name) => {
      if (!isRealName(name)) return;
      const clean = name.trim();
      const key = clean.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, clean);
    };

    rows.forEach((r) => add(r.name));
    add(configModule.getDefaultSubfolder());
    this._plexMappingSubfolders().forEach(add);

    return Array.from(byKey.values())
      .map((name) => buildSubfolderSegment(name))
      .sort();
  }

  /**
   * Tally how many rows reference each clean subfolder name, folded to lowercase
   * to match the registry's case-insensitive collation.
   * @param {Object} Model - Sequelize model (Channel or Playlist)
   * @param {string} column - The subfolder column name
   * @returns {Promise<Map<string, number>>} lowercased name -> count
   */
  async _tally(Model, column) {
    const rows = await Model.findAll({ attributes: [column] });
    const counts = new Map();
    for (const row of rows) {
      const value = row[column];
      if (!isRealName(value)) continue;
      const key = value.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  /**
   * Compute the usage of a single subfolder name (per-name queries). Used by
   * delete() where only one name is in play.
   * @param {string} clean - Clean subfolder name (no __ prefix)
   * @returns {Promise<{channels:number, playlists:number, isDefault:boolean, plexMapped:boolean, hasFiles:boolean}>}
   */
  async _usageForName(clean) {
    const channels = await Channel.count({ where: { sub_folder: clean } });
    const playlists = await Playlist.count({ where: { default_sub_folder: clean } });
    const def = configModule.getDefaultSubfolder();
    const isDefault = !!(def && def.toLowerCase() === clean.toLowerCase());
    const plexMapped = this._plexMappingSubfolders().some((s) => s.toLowerCase() === clean.toLowerCase());
    const hasFiles = await directoryHasFiles(path.join(configModule.directoryPath, buildSubfolderSegment(clean)));
    return { channels, playlists, isDefault, plexMapped, hasFiles };
  }

  /**
   * Usage breakdown per subfolder so the UI can show where each is used and
   * whether it's deletable, without attempting a delete.
   * @returns {Promise<Array<{name:string, displayName:string, usage:object, deletable:boolean}>>}
   */
  async getUsage() {
    const rows = await Subfolder.findAll({ attributes: ['name'] });

    const byKey = new Map(); // lowercased -> original (first-seen casing)
    const add = (name) => {
      if (!isRealName(name)) return;
      const clean = name.trim();
      const key = clean.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, clean);
    };
    rows.forEach((r) => add(r.name));
    add(configModule.getDefaultSubfolder());
    this._plexMappingSubfolders().forEach(add);

    const [channelTally, playlistTally] = await Promise.all([
      this._tally(Channel, 'sub_folder'),
      this._tally(Playlist, 'default_sub_folder'),
    ]);
    const def = configModule.getDefaultSubfolder();
    const defaultKey = def ? def.trim().toLowerCase() : null;
    const plexKeys = new Set(this._plexMappingSubfolders().map((s) => s.toLowerCase()));

    const items = await Promise.all(
      Array.from(byKey.entries()).map(async ([key, clean]) => {
        const hasFiles = await directoryHasFiles(
          path.join(configModule.directoryPath, buildSubfolderSegment(clean))
        );
        const usage = {
          channels: channelTally.get(key) || 0,
          playlists: playlistTally.get(key) || 0,
          isDefault: defaultKey === key,
          plexMapped: plexKeys.has(key),
          hasFiles,
        };
        return {
          name: clean,
          displayName: buildSubfolderSegment(clean),
          usage,
          deletable: deletionBlockReason(usage) === null,
        };
      })
    );

    return items.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Idempotently register a subfolder name. Ignores sentinels/null/empty.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async register(name) {
    if (!isRealName(name)) return;
    const clean = name.trim();
    try {
      await Subfolder.findOrCreate({ where: { name: clean }, defaults: { name: clean } });
    } catch (err) {
      // Unique-constraint race under case/accent-insensitive collation: treat as success.
      if (err && err.name === 'SequelizeUniqueConstraintError') return;
      logger.warn({ err, name: clean }, 'Failed to register subfolder');
    }
  }

  /**
   * Delete a subfolder from the registry, only when empty on disk and unused.
   * @param {string} name
   * @returns {Promise<void>}
   * @throws {Error} with .status 404 (unknown) or 409 (guard failed)
   */
  async delete(name) {
    const clean = (name || '').trim();
    if (!clean) throw makeError('Invalid subfolder name', 400);

    const exists = await Subfolder.count({ where: { name: clean } });
    if (exists === 0) throw makeError('Subfolder not found', 404);

    const reason = deletionBlockReason(await this._usageForName(clean));
    if (reason) throw makeError(reason, 409);

    const dirPath = path.join(configModule.directoryPath, buildSubfolderSegment(clean));
    await Subfolder.destroy({ where: { name: clean } });
    // Best-effort, non-recursive cleanup of the now-empty directory.
    await removeIfEmpty(dirPath);
  }
}

module.exports = new SubfolderModule();
