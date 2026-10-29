/**
 * Stored shows (tv_shows). A channel show is created once per channel and its
 * location (library folder + folder name) is pinned at creation, so a later
 * uploader rename or default-folder change never starts a second show folder.
 */

const TvShow = require('../../models/tvshow');
const { KIND_CHANNEL_SHOW } = require('./constants');
const {
  SHOW_FOLDER_MAX_BYTES,
  showFolderNameProblem,
  sanitizeShowFolderName,
  folderNameKey,
} = require('./showFolderNames');

// Folder names to try in order: the name itself, then the name with the
// channel id (a second channel with the same name, or a name media servers
// treat specially), then the channel id alone.
function folderNameCandidates(baseName, channelId) {
  const suffix = ` (${channelId})`;
  const base = baseName.endsWith(suffix) ? baseName.slice(0, -suffix.length) : baseName;
  return [base, `${base}${suffix}`, channelId]
    .filter((name) => name && showFolderNameProblem(name) === null);
}

function isUniqueConstraintError(err) {
  return Boolean(err && err.name === 'SequelizeUniqueConstraintError');
}

async function firstFreeFolderName(candidates, write) {
  for (const folderName of candidates) {
    try {
      return await write(folderName);
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }
  }
  throw new Error(`No free show folder name among: ${candidates.join(', ')}`);
}

/**
 * The channel's active channel show, if it has one.
 * @param {string} channelId - YouTube channel id
 */
async function findChannelShow(channelId) {
  return TvShow.findOne({ where: { channel_id: channelId, kind: KIND_CHANNEL_SHOW, retired_at: null } });
}

/**
 * Return the channel's channel show, creating it at libraryFolder when it
 * doesn't exist yet.
 *
 * @param {Object} params
 * @param {string} params.channelId - YouTube channel id (also the show's external key)
 * @param {string} params.name - Show name (the channel title)
 * @param {string} params.folderName - Wanted folder name; sanitized here
 * @param {string} params.libraryFolder - '' for the main folder, else the subfolder name
 * @param {string|null} [params.previousVideosFolder] - The channel's sub_folder before it switched to TV
 */
async function createChannelShow({ channelId, name, folderName, libraryFolder, previousVideosFolder = null }) {
  const existing = await findChannelShow(channelId);
  if (existing) return existing;

  const candidates = folderNameCandidates(sanitizeShowFolderName(folderName || name), channelId);
  return firstFreeFolderName(candidates, (folder) => TvShow.create({
    channel_id: channelId,
    kind: KIND_CHANNEL_SHOW,
    name: name || folder,
    folder_name: folder,
    library_folder: libraryFolder || '',
    external_key: channelId,
    previous_videos_folder: previousVideosFolder,
  }));
}

/**
 * Point a channel show at another library folder. Only for shows with no
 * files on disk: nothing is moved.
 */
async function relocateChannelShow(show, libraryFolder) {
  const candidates = folderNameCandidates(show.folder_name, show.channel_id);
  return firstFreeFolderName(candidates, async (folder) => {
    await show.update({ library_folder: libraryFolder || '', folder_name: folder });
    return show;
  });
}

/**
 * The folder name a channel show would get in a library folder, without
 * writing anything: the first candidate no other show there uses and no
 * earlier plan reserved. The reorganize previews and then creates shows with
 * exactly these names.
 *
 * @param {Object} params
 * @param {string} params.channelId
 * @param {string} params.folderName - Wanted name (sanitized here)
 * @param {string} params.libraryFolder
 * @param {number|null} [params.excludeShowId] - The show being moved, whose own name doesn't count
 * @param {Set<string>} [params.reserved] - Names planned for other shows in the same change; updated
 * @returns {Promise<string>}
 */
async function planChannelShowFolder({ channelId, folderName, libraryFolder, excludeShowId = null, reserved = new Set() }) {
  const candidates = folderNameCandidates(sanitizeShowFolderName(folderName), channelId);
  const used = await TvShow.findAll({ where: { library_folder: libraryFolder || '' }, attributes: ['id', 'folder_name'] });
  const taken = new Set(used
    .filter((row) => row.id !== excludeShowId)
    .map((row) => folderNameKey(libraryFolder, row.folder_name)));
  const choice = candidates.find((name) => {
    const key = folderNameKey(libraryFolder, name);
    return !taken.has(key) && !reserved.has(key);
  });
  if (!choice) throw new Error(`No free show folder name among: ${candidates.join(', ')}`);
  reserved.add(folderNameKey(libraryFolder, choice));
  return choice;
}

/**
 * Create a channel show at an exact, planned location.
 */
async function createChannelShowAt({ channelId, name, folderName, libraryFolder, previousVideosFolder = null }) {
  return TvShow.create({
    channel_id: channelId,
    kind: KIND_CHANNEL_SHOW,
    name: name || folderName,
    folder_name: folderName,
    library_folder: libraryFolder || '',
    external_key: channelId,
    previous_videos_folder: previousVideosFolder,
  });
}

/**
 * Point a show at an exact, planned location. Moving the files is the
 * caller's job.
 */
async function moveShowTo(show, { libraryFolder, folderName }) {
  await show.update({ library_folder: libraryFolder || '', folder_name: folderName });
  return show;
}

/**
 * @param {Object} show - tv_shows row
 * @returns {{id: number, libraryFolder: string, folderName: string}}
 */
function toLocation(show) {
  return { id: show.id, libraryFolder: show.library_folder || '', folderName: show.folder_name };
}

module.exports = {
  SHOW_FOLDER_MAX_BYTES,
  showFolderNameProblem,
  sanitizeShowFolderName,
  folderNameKey,
  findChannelShow,
  createChannelShow,
  relocateChannelShow,
  planChannelShowFolder,
  createChannelShowAt,
  moveShowTo,
  toLocation
};
