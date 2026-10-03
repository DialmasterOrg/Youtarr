/**
 * Shared TV show constants and helpers, kept free of dependencies so pure
 * modules can import them without loading config or the database.
 */

// Library folder layouts.
const LAYOUT_VIDEOS = 'videos';
const LAYOUT_TV = 'tv';

// Show kinds (tv_shows.kind).
const KIND_TITLE_SHOW = 'title';
const KIND_CHANNEL_SHOW = 'channel';

// Download types that produce MP3 output. TV folders are video-only.
const MP3_AUDIO_FORMATS = new Set(['mp3_only', 'video_mp3']);

function isMp3Format(audioFormat) {
  return MP3_AUDIO_FORMATS.has(audioFormat);
}

/**
 * Comparison key for a library folder name ('' = main folder): folder names
 * compare ignoring case, like the subfolders registry's collation.
 */
function folderKey(libraryFolder) {
  return String(libraryFolder || '').trim().toLowerCase();
}

module.exports = {
  folderKey,
  isMp3Format,
  MP3_AUDIO_FORMATS,
  LAYOUT_VIDEOS,
  LAYOUT_TV,
  KIND_TITLE_SHOW,
  KIND_CHANNEL_SHOW
};
