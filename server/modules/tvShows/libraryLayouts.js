/**
 * Layout of each library folder: the downloads folder itself ('') and each
 * __subfolder (named without the prefix). Media servers fix a library's type
 * per folder, so a folder holds either movie-style videos or TV shows.
 *
 * The main folder's layout is the mainFolderLayout config field; subfolder
 * layouts are stored on their subfolders row.
 */

const Subfolder = require('../../models/subfolder');
const configModule = require('../configModule');
const { LAYOUT_VIDEOS, LAYOUT_TV, folderKey } = require('./constants');

const LAYOUTS = new Set([LAYOUT_VIDEOS, LAYOUT_TV]);

function normalizeLayout(value) {
  return value === LAYOUT_TV ? LAYOUT_TV : LAYOUT_VIDEOS;
}


/**
 * Resolve library folder layouts. One query per call, so callers resolve once
 * per operation and reuse the returned function.
 *
 * @returns {Promise<(libraryFolder: string) => string>}
 */
async function getLayoutResolver() {
  const mainLayout = normalizeLayout((configModule.getConfig() || {}).mainFolderLayout);
  const rows = await Subfolder.findAll({ where: { layout: LAYOUT_TV }, attributes: ['name'] });
  const tvFolders = new Set(rows.map((row) => folderKey(row.name)));
  return (libraryFolder) => {
    const key = folderKey(libraryFolder);
    if (!key) return mainLayout;
    return tvFolders.has(key) ? LAYOUT_TV : LAYOUT_VIDEOS;
  };
}

/**
 * Library folders with the TV layout ('' = main folder), main folder first.
 * @returns {Promise<string[]>}
 */
async function listTvFolders() {
  const mainLayout = normalizeLayout((configModule.getConfig() || {}).mainFolderLayout);
  const rows = await Subfolder.findAll({ where: { layout: LAYOUT_TV }, attributes: ['name'] });
  const names = rows.map((row) => row.name.trim()).sort((a, b) => a.localeCompare(b));
  return mainLayout === LAYOUT_TV ? ['', ...names] : names;
}

/**
 * Store a library folder's layout. A subfolder must have its subfolders row
 * already (libraryFolders registers one known only from config first).
 *
 * @param {string} libraryFolder - '' for the main folder, else the subfolder name without __
 * @param {string} layout - LAYOUT_VIDEOS or LAYOUT_TV
 */
async function setLayout(libraryFolder, layout) {
  if (!LAYOUTS.has(layout)) {
    throw new TypeError(`Unknown library folder layout: ${layout}`);
  }
  const name = String(libraryFolder || '').trim();
  if (!name) {
    configModule.updateConfig({ ...configModule.getConfig(), mainFolderLayout: layout });
    return;
  }
  await Subfolder.update({ layout }, { where: { name } });
}

module.exports = {
  LAYOUT_VIDEOS,
  LAYOUT_TV,
  getLayoutResolver,
  listTvFolders,
  setLayout
};
