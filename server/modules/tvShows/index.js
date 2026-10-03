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
 * - tvNfo: episode NFO and tvshow.nfo files
 * - episodeInfo: episode details for API responses
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
