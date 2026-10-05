/**
 * Reorganize constants, dependency-free.
 */

// Kinds of settings change a reorganize applies.
const CHANGE_CHANNEL = 'channel';
const CHANGE_FOLDER_LAYOUT = 'folderLayout';
const CHANGE_DEFAULT_SUBFOLDER = 'defaultSubfolder';
// Accepted on the API and normalized to CHANGE_CHANNEL with the folder the
// Channel Settings layout toggle picks.
const CHANGE_CHANNEL_LAYOUT = 'channelLayout';
// A channel's title shows (or episode assignments) changed in a way that
// moves downloaded videos.
const CHANGE_TITLE_SHOWS = 'titleShows';

// What a change does to a show it plans.
const SHOW_ACTION = Object.freeze({ KEEP: 'keep', CREATE: 'create', MOVE: 'move' });

const OPERATION_STATUS = Object.freeze({
  RUNNING: 'running',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  FAILED: 'failed',
});

const ITEM_STATUS = Object.freeze({
  PENDING: 'pending',
  DONE: 'done',
  FAILED: 'failed',
});

// Why a video can't be moved, reported by the preview.
const PROBLEM = Object.freeze({
  MISSING: 'missing',
  COLLISION: 'collision',
  NO_NAME: 'no-name',
  NO_DATE: 'no-date',
  UNSAFE_NAME: 'unsafe-name',
  // A title episode waiting for its upload year whose number another video holds.
  EPISODE_TAKEN: 'episode-taken',
});

// Notes about a planned move, reported by the preview.
const FLAG = Object.freeze({
  OVERRIDE_PLACED: 'override-placed',
  ADOPTED: 'adopted',
  UPLOAD_DATE_ONLY: 'upload-date-only',
  DOWNLOAD_TIME: 'download-time',
  MOVIE_TAGS: 'movie-tags',
});

// The preview lists at most this many moves and problems; totals are complete.
const PREVIEW_ITEM_LIMIT = 200;

// WebSocket message type for operation progress.
const PROGRESS_MESSAGE_TYPE = 'tvReorganizeProgress';

module.exports = {
  CHANGE_CHANNEL,
  CHANGE_FOLDER_LAYOUT,
  CHANGE_DEFAULT_SUBFOLDER,
  CHANGE_CHANNEL_LAYOUT,
  CHANGE_TITLE_SHOWS,
  SHOW_ACTION,
  OPERATION_STATUS,
  ITEM_STATUS,
  PROBLEM,
  FLAG,
  PREVIEW_ITEM_LIMIT,
  PROGRESS_MESSAGE_TYPE
};
