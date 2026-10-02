/**
 * Layout of each library folder: the downloads folder itself ('') and each
 * __subfolder (named without the prefix). Media servers fix a library's type
 * per folder, so a folder holds either movie-style videos or TV shows.
 */

const LAYOUT_VIDEOS = 'videos';
const LAYOUT_TV = 'tv';

/**
 * Resolve library folder layouts. Every folder uses the videos layout until
 * folder layouts can be configured.
 *
 * @returns {Promise<(libraryFolder: string) => string>}
 */
async function getLayoutResolver() {
  return () => LAYOUT_VIDEOS;
}

module.exports = {
  LAYOUT_VIDEOS,
  LAYOUT_TV,
  getLayoutResolver
};
