/**
 * Jellyfin's and Emby's library settings as the library check needs them.
 * Both servers describe a library (GET /Library/VirtualFolders) with a
 * CollectionType and LibraryOptions in the same shape.
 */

const { LIBRARY_TYPES } = require('./baseAdapter');

const NFO_SAVER = 'nfo';

const COLLECTION_LIBRARY_TYPES = {
  tvshows: LIBRARY_TYPES.TV,
  movies: LIBRARY_TYPES.VIDEOS,
  homevideos: LIBRARY_TYPES.VIDEOS,
  music: LIBRARY_TYPES.MUSIC,
  mixed: LIBRARY_TYPES.MIXED,
};

// Item types whose metadata fetchers and savers matter per library type.
const ITEM_TYPES = {
  [LIBRARY_TYPES.TV]: ['Series', 'Episode'],
  [LIBRARY_TYPES.VIDEOS]: ['Movie', 'Video'],
  [LIBRARY_TYPES.MIXED]: ['Series', 'Episode', 'Movie', 'Video'],
};

/** A Mixed library has no CollectionType (Jellyfin) or 'mixed' (Emby). */
function libraryTypeOf(collectionType) {
  if (!collectionType) return LIBRARY_TYPES.MIXED;
  return COLLECTION_LIBRARY_TYPES[String(collectionType).toLowerCase()] || LIBRARY_TYPES.OTHER;
}

/**
 * Whether the server writes NFO files into this library's folders. A null
 * MetadataSavers means the server-wide default applies: savers write only
 * when the library saves metadata locally, unless the server disables the
 * NFO saver for these item types.
 *
 * @param {Object} options - LibraryOptions
 * @param {string} type - LIBRARY_TYPES value
 * @param {Array<Object>|null} serverMetadataOptions - ServerConfiguration.MetadataOptions, null if unread
 * @returns {boolean|null}
 */
function nfoSaverOf(options, type, serverMetadataOptions) {
  const savers = options?.MetadataSavers;
  if (Array.isArray(savers)) return savers.some((saver) => String(saver).toLowerCase() === NFO_SAVER);
  if (options?.SaveLocalMetadata === false) return false;
  if (!Array.isArray(serverMetadataOptions)) return null;
  const itemTypes = ITEM_TYPES[type] || [];
  const disabledEverywhere = itemTypes.length > 0 && itemTypes.every((itemType) => {
    const entry = serverMetadataOptions.find((candidate) => candidate.ItemType === itemType);
    return (entry?.DisabledMetadataSavers || []).some((saver) => String(saver).toLowerCase() === NFO_SAVER);
  });
  return !disabledEverywhere;
}

/**
 * Whether online metadata providers fill in this library's items. Null when
 * the library has no settings for these item types (the server default applies).
 *
 * @param {Object} options - LibraryOptions
 * @param {string} type - LIBRARY_TYPES value
 * @returns {boolean|null}
 */
function onlineFetchersOf(options, type) {
  const itemTypes = ITEM_TYPES[type] || [];
  const entries = (options?.TypeOptions || []).filter((entry) => itemTypes.includes(entry.Type));
  if (entries.length === 0) return null;
  return entries.some((entry) => (entry.MetadataFetchers || []).length > 0);
}

/** Whether any library needs the server's default metadata options to tell its NFO saver state. */
function needsServerDefaults(virtualFolders) {
  return virtualFolders.some((folder) => !Array.isArray(folder.LibraryOptions?.MetadataSavers)
    && folder.LibraryOptions?.SaveLocalMetadata !== false);
}

module.exports = {
  libraryTypeOf,
  nfoSaverOf,
  onlineFetchersOf,
  needsServerDefaults
};
