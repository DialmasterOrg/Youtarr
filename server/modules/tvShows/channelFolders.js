/**
 * Where a tracked channel's files live. A channel in a videos folder has its
 * channel folder (<library folder>/<folder_name>); a channel in a TV folder
 * has its show folder, pinned on its tv_shows row, which can differ from
 * folder_name and from the channel's current library folder.
 */

const path = require('path');
const { Op } = require('sequelize');
const configModule = require('../configModule');
// pathBuilder only: the filesystem aggregator would load fs-extra into every module that resolves a folder.
const { resolveEffectiveSubfolder, buildChannelPath, resolveChannelFolderName, buildSubfolderSegment } = require('../filesystem/pathBuilder');
const { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } = require('../filesystem/constants');
const { LAYOUT_TV } = require('./constants');
const { getLayoutResolver, listTvFolders } = require('./libraryLayouts');
const showStore = require('./showStore');

/**
 * Library folder a sub_folder value resolves to ('' = main folder).
 * @param {string|null} subFolderValue - channels.sub_folder (may be a sentinel)
 */
function effectiveLibraryFolder(subFolderValue) {
  return resolveEffectiveSubfolder(subFolderValue, configModule.getDefaultSubfolder()) || '';
}

/**
 * Absolute path of a show's folder.
 * @param {{library_folder: string, folder_name: string}} show
 */
function showDirectory(show) {
  const baseDir = configModule.directoryPath;
  const libraryDir = show.library_folder ? path.join(baseDir, buildSubfolderSegment(show.library_folder)) : baseDir;
  return path.join(libraryDir, show.folder_name);
}

/**
 * @param {Object} channel - channels row (sub_folder, channel_id, folder_name, uploader)
 * @param {Object} [options]
 * @param {(libraryFolder: string) => string} [options.layoutOf] - Reuse a resolver across channels
 * @returns {Promise<{layout: string, dir: string|null}>} dir is null for a TV
 *   channel whose show doesn't exist yet, or a channel without a folder name
 */
async function resolveChannelDirectory(channel, { layoutOf } = {}) {
  const resolveLayout = layoutOf || await getLayoutResolver();
  const libraryFolder = effectiveLibraryFolder(channel.sub_folder);
  const layout = resolveLayout(libraryFolder);
  if (layout === LAYOUT_TV) {
    const show = await showStore.findChannelShow(channel.channel_id);
    return { layout, dir: show ? showDirectory(show) : null };
  }
  const folderName = resolveChannelFolderName(channel);
  return { layout, dir: folderName ? buildChannelPath(configModule.directoryPath, libraryFolder || null, folderName) : null };
}

/**
 * @param {Object} channel - channels row
 * @param {(libraryFolder: string) => string} [layoutOf]
 * @returns {Promise<boolean>}
 */
async function isTvChannel(channel, layoutOf) {
  const resolveLayout = layoutOf || await getLayoutResolver();
  return resolveLayout(effectiveLibraryFolder(channel.sub_folder)) === LAYOUT_TV;
}

/**
 * Sequelize condition on channels.sub_folder matching channels that download
 * to a TV folder, or null when no folder is TV.
 * @returns {Promise<Object|null>}
 */
async function tvChannelCondition() {
  const tvFolders = await listTvFolders();
  const keys = new Set(tvFolders.map((name) => name.toLowerCase()));
  const named = tvFolders.filter(Boolean);
  const conditions = [];
  if (named.length > 0) conditions.push({ sub_folder: { [Op.in]: named } });
  if (keys.has(String(configModule.getDefaultSubfolder() || '').toLowerCase())) {
    conditions.push({ sub_folder: GLOBAL_DEFAULT_SENTINEL });
  }
  if (keys.has('')) {
    conditions.push({ sub_folder: { [Op.or]: [null, '', ROOT_SENTINEL] } });
  }
  return conditions.length > 0 ? { [Op.or]: conditions } : null;
}

module.exports = {
  effectiveLibraryFolder,
  tvChannelCondition,
  showDirectory,
  resolveChannelDirectory,
  isTvChannel
};
