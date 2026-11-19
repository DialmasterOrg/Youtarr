/**
 * Why a library folder can't be deleted. One rule for the DELETE guard
 * (subfolderModule.delete, which answers with the first reason) and the
 * folder usage the Library folders page shows (every reason), so they can't
 * drift. A Plex refresh mapping is no reason: deleting the folder removes it.
 *
 * @typedef {{channels: number, disabledChannels: number, playlists: number, shows: number,
 *   isDefault: boolean, hasFiles: boolean}} FolderUsage
 */

/**
 * @param {FolderUsage} usage
 * @returns {Array<{code: string, count?: number}>}
 */
function deletionBlockers(usage) {
  const blockers = [];
  if (usage.channels > 0) blockers.push({ code: 'channels', count: usage.channels });
  if (usage.disabledChannels > 0) blockers.push({ code: 'disabledChannels', count: usage.disabledChannels });
  if (usage.playlists > 0) blockers.push({ code: 'playlists', count: usage.playlists });
  if (usage.shows > 0) blockers.push({ code: 'shows', count: usage.shows });
  if (usage.isDefault) blockers.push({ code: 'default' });
  if (usage.hasFiles) blockers.push({ code: 'files' });
  return blockers;
}

/**
 * @param {FolderUsage} usage
 * @returns {string|null} the first reason, as the DELETE route answers it
 */
function deletionBlockReason(usage) {
  const [first] = deletionBlockers(usage);
  if (!first) return null;
  switch (first.code) {
  case 'channels':
  case 'disabledChannels':
    return `Subfolder is in use by ${(usage.channels || 0) + (usage.disabledChannels || 0)} channel(s)`;
  case 'playlists':
    return `Subfolder is in use by ${usage.playlists} playlist(s)`;
  case 'shows':
    return `Subfolder holds ${usage.shows} TV show(s) with numbered episodes`;
  case 'default':
    return 'Subfolder is the global default and cannot be deleted';
  default:
    return 'Subfolder still contains downloaded files and cannot be deleted';
  }
}

module.exports = { deletionBlockers, deletionBlockReason };
