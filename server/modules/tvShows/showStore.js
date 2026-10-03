/**
 * Stored shows (tv_shows). A channel show is created once per channel and its
 * location (library folder + folder name) is pinned at creation, so a later
 * uploader rename or default-folder change never starts a second show folder.
 */

const TvShow = require('../../models/tvshow');
const { sanitizeFilenameLikeYtDlp, sanitizeNameLikeYtDlp } = require('../filesystem/sanitizer');
const { SEASON_FOLDER_PATTERN, SUBFOLDER_PREFIX } = require('../filesystem/constants');
const { KIND_CHANNEL_SHOW } = require('./constants');

// Same cap as the channel folder in the yt-dlp output template (.80B).
const SHOW_FOLDER_MAX_BYTES = 80;

// Folder names Jellyfin reads as extras inside a show (compared ignoring case).
const EXTRAS_FOLDER_NAMES = new Set([
  'trailers', 'backdrops', 'theme-music', 'behind the scenes', 'deleted scenes', 'interviews',
  'scenes', 'samples', 'sample', 'shorts', 'featurettes', 'extras', 'extra', 'other', 'clips',
]);

/**
 * Why a name can't be a show folder, or null when it can.
 * @param {string} name
 * @returns {string|null}
 */
function showFolderNameProblem(name) {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return 'Show folder name is empty';
  if (value.startsWith(SUBFOLDER_PREFIX)) return `Show folder name can't start with ${SUBFOLDER_PREFIX}`;
  if (value.startsWith('.')) return 'Show folder name can\'t start with .';
  if (/[/\\]/.test(value)) return 'Show folder name can\'t contain a path separator';
  if (SEASON_FOLDER_PATTERN.test(value)) return 'Show folder name can\'t be a season folder name';
  if (EXTRAS_FOLDER_NAMES.has(value.toLowerCase())) return `"${value}" is a media-server extras folder name`;
  return null;
}

function sanitizeShowFolderName(name) {
  const sanitized = sanitizeFilenameLikeYtDlp(String(name || ''), { maxBytes: SHOW_FOLDER_MAX_BYTES });
  return sanitized ? sanitizeNameLikeYtDlp(sanitized) : '';
}

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
 * @param {Object} show - tv_shows row
 * @returns {{id: number, libraryFolder: string, folderName: string}}
 */
function toLocation(show) {
  return { id: show.id, libraryFolder: show.library_folder || '', folderName: show.folder_name };
}

module.exports = {
  SHOW_FOLDER_MAX_BYTES,
  showFolderNameProblem,
  findChannelShow,
  createChannelShow,
  relocateChannelShow,
  toLocation
};
