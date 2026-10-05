/**
 * TV show support: channels and title-pattern shows saved as TV shows
 * (<library folder>/<show>/Season NN/SxxEyy - Title [id].ext).
 *
 * - constants: layouts and show kinds (no dependencies)
 * - libraryLayouts: the layout (videos or tv) of each library folder
 * - libraryFolders: the folder list and layout changes (Settings)
 * - layoutGuards: refusals that keep a folder from mixing layouts
 * - channelFolders: where a channel's files live (channel or show folder)
 * - channelLayout: a channel's TV state and its folder changes
 * - showStore: stored shows and their pinned locations
 * - episodeNaming: season folder names and episode file stems
 * - dateNumbering: upload-time season and episode numbers
 * - episodeAllocator: stored, unique episode numbers per show
 * - routing: where a downloaded video belongs
 * - episodePlacement: the post-processor's TV branch
 * - tvNfo: episode NFO, tvshow.nfo and season.nfo files
 * - episodeInfo: episode details for API responses
 *
 * Title shows (shows defined on a channel by title patterns):
 * - patternCompiler: simple syntax and regex mode to Python regexes and download filters
 * - showFolderNames: show folder name rules (no dependencies)
 * - titleShowDrafts: validated, compiled drafts of a channel's title shows
 * - titleShowStore: stored title shows, patterns and seasons
 * - titleMatcher: which show and pattern each title matches (one Python batch)
 * - titleNumbering: episode numbers, duplicates and gaps (pure)
 * - titlePlanner: a channel's title shows after a change, for every video
 * - titlePreview: the editor's preview of a plan
 * - titleRowWriter: writes a plan's definitions, rows and conflicts
 * - titleShowSaver: saves a change directly or asks for the reorganize
 * - titleShowService: title shows as the API sees them
 * - titleShowQueries: counts, missing episodes, show filter, planned episodes
 * - titleEpisodeAssigner: the post-processor's title show decision
 * - episodeConflicts: duplicates and classification errors, with provenance
 * - archiveSuppressor: the deferred complete.list writer
 *
 * Callers require the submodule they need; most of them read the database.
 */

const constants = require('./constants');
const libraryLayouts = require('./libraryLayouts');
const libraryFolders = require('./libraryFolders');
const layoutGuards = require('./layoutGuards');
const channelFolders = require('./channelFolders');
const channelLayout = require('./channelLayout');
const showStore = require('./showStore');
const episodeNaming = require('./episodeNaming');
const dateNumbering = require('./dateNumbering');
const episodeAllocator = require('./episodeAllocator');
const routing = require('./routing');
const episodePlacement = require('./episodePlacement');
const tvNfo = require('./tvNfo');
const episodeInfo = require('./episodeInfo');

module.exports = {
  constants,
  libraryLayouts,
  libraryFolders,
  layoutGuards,
  channelFolders,
  channelLayout,
  showStore,
  episodeNaming,
  dateNumbering,
  episodeAllocator,
  routing,
  episodePlacement,
  tvNfo,
  episodeInfo
};
