/**
 * Where a downloaded video belongs. The post-processor, the reorganize preview
 * and the reorganize itself all decide through this one rule:
 * 1. A video of a tracked, enabled channel that is classified into one of the
 *    channel's title shows goes to that show. The download dialog's subfolder
 *    override does not apply to it.
 * 2. Otherwise the folder resolves as it always has (dialog override, tracked
 *    channel, playlist fallback, global default); callers pass the result in.
 * 3. In a TV folder the video joins its owner channel's channel show. Once
 *    that show exists its stored location wins, so a later default-folder
 *    change or a dialog override to another TV folder never splits it. A new
 *    show is named after the owner channel's folder, not the uploader, so
 *    VEVO/Topic uploads join their owner's show.
 * 4. In a videos folder the video is saved movie-style.
 */

const { LAYOUT_VIDEOS, LAYOUT_TV } = require('./libraryLayouts');
const { MAIN_LIBRARY_FOLDER } = require('../filesystem/constants');

const KIND_TITLE_SHOW = 'title';
const KIND_CHANNEL_SHOW = 'channel';

/**
 * @param {Object} inputs
 * @param {{channelId: string, folderName: string, tracked: boolean, enabled: boolean}} inputs.ownerChannel
 *   The channel that owns the video (tracked = it has a channels row)
 * @param {{id: number, libraryFolder: string, folderName: string}|null} [inputs.titleShow]
 *   The owner channel's title show the video is classified into
 * @param {{id: number, libraryFolder: string, folderName: string}|null} [inputs.channelShow]
 *   The owner channel's existing channel show
 * @param {string|null} [inputs.resolvedSubfolder] - The resolved subfolder (without __), null for the main folder
 * @param {(libraryFolder: string) => string} inputs.layoutOf - Layout of a library folder ('' = main)
 * @returns {{layout: 'videos', libraryFolder: string}
 *   | {layout: 'tv', kind: string, showId: number|null, channelId: string, libraryFolder: string, folderName: string}}
 *   showId null means the channel show does not exist yet and is created there
 */
function resolveDestination({ ownerChannel, titleShow = null, channelShow = null, resolvedSubfolder = null, layoutOf }) {
  if (titleShow && ownerChannel && ownerChannel.tracked && ownerChannel.enabled) {
    return {
      layout: LAYOUT_TV,
      kind: KIND_TITLE_SHOW,
      showId: titleShow.id,
      channelId: ownerChannel.channelId,
      libraryFolder: titleShow.libraryFolder,
      folderName: titleShow.folderName
    };
  }

  const libraryFolder = resolvedSubfolder || MAIN_LIBRARY_FOLDER;
  if (layoutOf(libraryFolder) !== LAYOUT_TV) {
    return { layout: LAYOUT_VIDEOS, libraryFolder };
  }

  if (!ownerChannel || !ownerChannel.channelId || !ownerChannel.folderName) {
    throw new TypeError('Routing to a channel show needs the owner channel id and folder name');
  }
  const location = channelShow
    ? { showId: channelShow.id, libraryFolder: channelShow.libraryFolder, folderName: channelShow.folderName }
    : { showId: null, libraryFolder, folderName: ownerChannel.folderName };
  return { layout: LAYOUT_TV, kind: KIND_CHANNEL_SHOW, channelId: ownerChannel.channelId, ...location };
}

module.exports = {
  KIND_TITLE_SHOW,
  KIND_CHANNEL_SHOW,
  resolveDestination
};
