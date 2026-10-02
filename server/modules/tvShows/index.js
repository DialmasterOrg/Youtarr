/**
 * TV show support: channels and title-pattern shows saved as TV shows
 * (<library folder>/<show>/Season NN/SxxEyy - Title [id].ext).
 *
 * - libraryLayouts: the layout (videos or tv) of each library folder
 * - episodeNaming: season folder names and episode file stems
 * - dateNumbering: upload-time season and episode numbers
 * - routing: where a downloaded video belongs
 */

const libraryLayouts = require('./libraryLayouts');
const episodeNaming = require('./episodeNaming');
const dateNumbering = require('./dateNumbering');
const routing = require('./routing');

module.exports = {
  libraryLayouts,
  episodeNaming,
  dateNumbering,
  routing
};
