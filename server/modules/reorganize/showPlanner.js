/**
 * Where each moved video goes, and the channel shows a change creates or
 * moves. A video's destination is its channel's folder after the change (a
 * library folder whose layout changes keeps its videos), and in a TV folder
 * its owner channel's show:
 * - a channel that moves takes its show with it;
 * - in a folder that switches to TV, an existing show in another TV folder
 *   keeps its location (the routing rule: a show is never split), and a show
 *   left in a folder that is no longer TV moves to the new one.
 */

const path = require('path');
const showStore = require('../tvShows/showStore');
const { resolveChannelFolderName } = require('../filesystem/pathBuilder');
const { ROOT_SENTINEL } = require('../filesystem/constants');
const { LAYOUT_TV, LAYOUT_VIDEOS, folderKey } = require('../tvShows/constants');
const { showDirectory } = require('../tvShows/channelFolders');
const { CHANGE_CHANNEL, CHANGE_FOLDER_LAYOUT } = require('./constants');
const { libraryRootOf } = require('./changeScope');

const SHOW_ACTION = Object.freeze({ KEEP: 'keep', CREATE: 'create', MOVE: 'move' });

/**
 * @param {Object} subject - changeScope subject
 * @param {Object} context - resolved change
 * @returns {{libraryFolder: string, layout: string}}
 */
function targetOf(subject, context) {
  if (context.type === CHANGE_FOLDER_LAYOUT) {
    return { libraryFolder: subject.libraryFolder, layout: context.layoutAfter(subject.libraryFolder) };
  }
  const owner = subject.ownerChannel;
  const libraryFolder = owner ? context.folderAfter(owner) : subject.libraryFolder;
  return { libraryFolder, layout: context.layoutAfter(libraryFolder) };
}

// The channel folder a movie-style video sits in, the natural name for a
// show made from it.
function currentChannelFolder(subject) {
  if (subject.currentLayout !== LAYOUT_VIDEOS) return null;
  const mediaPath = subject.video.filePath || subject.video.audioFilePath;
  const relative = path.relative(libraryRootOf(subject.libraryFolder), mediaPath);
  return relative.split(path.sep)[0] || null;
}

function previousVideosFolderFor(context) {
  if (context.type !== CHANGE_CHANNEL || context.layoutBefore(context.fromFolder) !== LAYOUT_VIDEOS) return null;
  const previous = context.stored.previousSubFolder;
  return previous === null || previous === undefined || previous === '' ? ROOT_SENTINEL : previous;
}

async function planShow({ ownerChannelId, subject, libraryFolder, context, reserved }) {
  const owner = subject.ownerChannel;
  const existing = await showStore.findChannelShow(ownerChannelId);
  const name = (owner && (owner.title || owner.uploader)) || subject.video.youTubeChannelName || ownerChannelId;
  const plot = owner ? owner.description || null : null;

  if (existing) {
    const keepsLocation = context.type === CHANGE_FOLDER_LAYOUT
      ? context.layoutAfter(existing.library_folder) === LAYOUT_TV
      : folderKey(existing.library_folder) === folderKey(libraryFolder);
    if (keepsLocation) {
      return {
        ownerChannelId, showId: existing.id, action: SHOW_ACTION.KEEP, name: existing.name,
        libraryFolder: existing.library_folder, folderName: existing.folder_name, plot, externalKey: existing.external_key,
      };
    }
    const folderName = await showStore.planChannelShowFolder({
      channelId: ownerChannelId, folderName: existing.folder_name, libraryFolder, excludeShowId: existing.id, reserved,
    });
    return {
      ownerChannelId, showId: existing.id, action: SHOW_ACTION.MOVE, name: existing.name,
      libraryFolder, folderName, plot, externalKey: existing.external_key,
      previousLocation: { libraryFolder: existing.library_folder, folderName: existing.folder_name },
      previousVideosFolder: previousVideosFolderFor(context),
    };
  }

  const wanted = (owner && resolveChannelFolderName(owner)) || currentChannelFolder(subject) || name;
  const folderName = await showStore.planChannelShowFolder({ channelId: ownerChannelId, folderName: wanted, libraryFolder, reserved });
  return {
    ownerChannelId, showId: null, action: SHOW_ACTION.CREATE, name,
    libraryFolder, folderName, plot, externalKey: ownerChannelId,
    previousVideosFolder: previousVideosFolderFor(context),
  };
}

/**
 * Plan the show of every owner channel with videos going to a TV folder.
 *
 * @param {Array<Object>} subjects - changeScope subjects
 * @param {Object} context - resolved change
 * @returns {Promise<{targets: Map<number, {libraryFolder: string, layout: string}>, shows: Map<string, Object>}>}
 *   targets by Videos.id; shows by owner channel id
 */
async function planShows(subjects, context) {
  const targets = new Map();
  const shows = new Map();
  const reserved = new Set();
  for (const subject of subjects) {
    const target = targetOf(subject, context);
    targets.set(subject.video.id, target);
    if (target.layout !== LAYOUT_TV || shows.has(subject.ownerChannelId)) continue;
    shows.set(subject.ownerChannelId, await planShow({
      ownerChannelId: subject.ownerChannelId, subject, libraryFolder: target.libraryFolder, context, reserved,
    }));
  }
  return { targets, shows };
}

/**
 * Absolute folder of a planned show.
 */
function plannedShowDirectory(plannedShow) {
  return showDirectory({ library_folder: plannedShow.libraryFolder, folder_name: plannedShow.folderName });
}

/**
 * Absolute folder a planned show had before the change, or null.
 */
function previousShowDirectory(plannedShow) {
  if (!plannedShow.previousLocation) return null;
  const { libraryFolder, folderName } = plannedShow.previousLocation;
  return showDirectory({ library_folder: libraryFolder, folder_name: folderName });
}

module.exports = {
  SHOW_ACTION,
  planShows,
  targetOf,
  plannedShowDirectory,
  previousShowDirectory
};
