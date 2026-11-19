/**
 * The revision token of a reorganize plan: a hash of the change, the show
 * locations it pins, and every planned file move with its source's size and
 * modification time. Apply recomputes the plan and refuses a token that no
 * longer matches, so nothing moves on the strength of a stale preview.
 */

const crypto = require('crypto');

/**
 * @param {Object} plan
 * @param {Object} plan.change - The normalized change
 * @param {Array<Object>} plan.shows - Planned shows
 * @param {Array<Object>} plan.items - Planned moves (sorted)
 * @returns {string}
 */
function planRevision({ change, shows, items }) {
  const payload = {
    change,
    shows: shows
      .map((show) => [show.key || show.ownerChannelId, show.action, show.libraryFolder, show.folderName])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    items: items.map((item) => [
      item.youtubeId,
      item.files.map((file) => [file.from, file.to, file.size, file.mtimeMs]),
      item.classification ? [item.classification.season, item.classification.episode, item.classification.fileStem] : null,
    ]),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

module.exports = { planRevision };
