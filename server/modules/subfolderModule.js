const path = require('path');
const logger = require('../logger');
const Subfolder = require('../models/subfolder');
const Channel = require('../models/channel');
const Playlist = require('../models/playlist');
const TvShow = require('../models/tvshow');
const VideoClassification = require('../models/videoclassification');
const configModule = require('./configModule');
const { buildSubfolderSegment, directoryHasFiles, removeIfEmpty, resolveEffectiveSubfolder } = require('./filesystem');
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } = require('./filesystem/constants');
const { getLayoutResolver } = require('./tvShows/libraryLayouts');
const { LAYOUT_TV, KIND_TITLE_SHOW } = require('./tvShows/constants');

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
 * @param {{channels:number, playlists:number, shows:number, isDefault:boolean, plexMapped:boolean, hasFiles:boolean}} usage
 * @returns {string|null} reason, or null when the subfolder is safe to delete
 */
function deletionBlockReason(usage) {
  if (usage.channels > 0) {
    return `Subfolder is in use by ${usage.channels} channel(s)`;
  }
  if (usage.playlists > 0) {
    return `Subfolder is in use by ${usage.playlists} playlist(s)`;
  }
  if (usage.shows > 0) {
    return `Subfolder holds ${usage.shows} TV show(s) with numbered episodes`;
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

/**
 * Channels whose current folder has the TV layout, among the given ids. A
 * tracked channel that moved back to a videos folder keeps its show row (for
 * the way back) but no longer uses the show's folder.
 * @param {string[]} channelIds
 * @returns {Promise<{isTracked: (id: string) => boolean, isTv: (id: string) => boolean}>}
 */
async function tvChannelLookup(channelIds) {
  const [channels, layoutOf] = await Promise.all([
    Channel.findAll({ where: { channel_id: channelIds }, attributes: ['channel_id', 'sub_folder'] }),
    getLayoutResolver(),
  ]);
  const defaultSubfolder = configModule.getDefaultSubfolder();
  const tvByChannel = new Map(channels.map((channel) => [
    channel.channel_id,
    layoutOf(resolveEffectiveSubfolder(channel.sub_folder, defaultSubfolder) || '') === LAYOUT_TV,
  ]));
  return { isTracked: (id) => tvByChannel.has(id), isTv: (id) => tvByChannel.get(id) === true };
}

/**
 * TV shows with numbered episodes, per library folder (lowercased). Their
 * numbers are kept even when files are deleted, so a re-download returns to
 * the same episode; a show without any only pins a location. A channel show
 * whose tracked channel has since moved to a videos folder is not counted; an
 * untracked channel's show always is, since the folder is all it has, and so
 * is a title show, which lives in its TV folder whatever folder its channel uses.
 * @returns {Promise<Map<string, number>>}
 */
async function tallyNumberedShows() {
  const rows = await VideoClassification.findAll({
    attributes: ['show_id'],
    group: ['show_id'],
    raw: true,
  });
  const showIds = rows.map((row) => row.show_id);
  const counts = new Map();
  if (showIds.length === 0) return counts;
  const shows = await TvShow.findAll({
    where: { id: showIds, retired_at: null },
    attributes: ['library_folder', 'channel_id', 'kind'],
  });
  const channels = await tvChannelLookup([...new Set(shows.map((show) => show.channel_id).filter(Boolean))]);
  for (const show of shows) {
    if (show.kind !== KIND_TITLE_SHOW && channels.isTracked(show.channel_id) && !channels.isTv(show.channel_id)) continue;
    const key = String(show.library_folder || '').trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
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
   * @returns {Promise<{channels:number, playlists:number, shows:number, isDefault:boolean, plexMapped:boolean, hasFiles:boolean}>}
   */
  async _usageForName(clean) {
    const channels = await Channel.count({ where: { sub_folder: clean } });
    const playlists = await Playlist.count({ where: { default_sub_folder: clean } });
    const shows = (await tallyNumberedShows()).get(clean.toLowerCase()) || 0;
    const def = configModule.getDefaultSubfolder();
    const isDefault = !!(def && def.toLowerCase() === clean.toLowerCase());
    const plexMapped = this._plexMappingSubfolders().some((s) => s.toLowerCase() === clean.toLowerCase());
    const hasFiles = await directoryHasFiles(path.join(configModule.directoryPath, buildSubfolderSegment(clean)));
    return { channels, playlists, shows, isDefault, plexMapped, hasFiles };
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

    const [channelTally, playlistTally, showTally] = await Promise.all([
      this._tally(Channel, 'sub_folder'),
      this._tally(Playlist, 'default_sub_folder'),
      tallyNumberedShows(),
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
          shows: showTally.get(key) || 0,
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
