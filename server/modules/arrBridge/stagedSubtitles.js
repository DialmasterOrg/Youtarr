// Names for the subtitle files handed to Sonarr and Radarr beside a staged
// video. With "Import Extra Files" on, the apps import an .srt whose name
// starts with the video's and read its language from the last part of the
// name only, as a 2 or 3 letter code: "en-GB" imports with no language and
// "fr-CA" as Catalan. So a track is staged under its bare language code.
const { isFileForVideo } = require('../filesystem/pathBuilder');
const { SUBTITLE_SIDECAR_CODE } = require('../download/subtitleSidecarPruner');

const APPLE_DOUBLE_PREFIX = '._';
const BARE_LANGUAGE_CODE = /^[a-z]{2,3}$/;

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Tracks that share a language (en-CA and en-GB, zh-Hans and zh-Hant) are all
 * planned, numbered before the code: the apps import each one and number them
 * the same way, and dropping one here would lose it without a trace. The
 * caller leaves out tracks that hold the same text before it plans.
 *
 * @param {Object} params
 * @param {string[]} params.fileNames - Names of the files in the library file's folder
 * @param {string} params.youtubeId - The grabbed video's YouTube id
 * @param {string} params.releaseTitle - The release name the video is staged under
 * @returns {Array<{sourceName: string, stagedName: string, language: string}>}
 */
function planStagedSubtitles({ fileNames, youtubeId, releaseTitle }) {
  if (!youtubeId || !Array.isArray(fileNames)) return [];

  const tracksByLanguage = new Map();
  for (const fileName of fileNames) {
    if (fileName.startsWith(APPLE_DOUBLE_PREFIX) || !isFileForVideo(fileName, youtubeId)) continue;
    const match = fileName.match(SUBTITLE_SIDECAR_CODE);
    if (!match) continue;
    const code = match[1].toLowerCase();
    const language = code.split('-')[0];
    if (!BARE_LANGUAGE_CODE.test(language)) continue;
    if (!tracksByLanguage.has(language)) tracksByLanguage.set(language, []);
    tracksByLanguage.get(language).push({ fileName, code });
  }

  const planned = [];
  for (const language of [...tracksByLanguage.keys()].sort(compare)) {
    const tracks = tracksByLanguage.get(language)
      .sort((a, b) => compare(a.code, b.code) || compare(a.fileName, b.fileName));
    tracks.forEach(({ fileName }, index) => {
      const copy = tracks.length > 1 ? `.${index + 1}` : '';
      planned.push({ sourceName: fileName, stagedName: `${releaseTitle}${copy}.${language}.srt`, language });
    });
  }
  return planned;
}

module.exports = { planStagedSubtitles };
