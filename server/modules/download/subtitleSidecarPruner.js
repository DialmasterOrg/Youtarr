const { isFileForVideo } = require('../filesystem/pathBuilder');
const { checkCustomArgs } = require('./customArgsParser');
const {
  parseSubtitleLanguages,
  isExpandableLanguageCode,
  isPlainLanguageCode,
} = require('./subtitleLanguages');

// Youtarr names subtitle sidecars "<name> [ID].<code>.srt", where <code> is
// the track code yt-dlp used (en, en-GB, zh-Hans, en-orig).
const SUBTITLE_SIDECAR_CODE = /\]\.([A-Za-z0-9-]+)\.srt$/;

// Canonical yt-dlp options that change which subtitle tracks are requested. A
// repeated --sub-langs is appended to Youtarr's own value rather than replacing
// it, so with any of these in the custom args the effective selection is
// unknown here and nothing is pruned. checkCustomArgs resolves every spelling
// (--srt-langs, --sub-lang, --all-sub, ...) to one of these canonical names.
const SUBTITLE_SELECTION_CANONICAL = new Set(['--sub-langs', '--all-subs']);

function baseLanguage(code) {
  return code.split('-')[0];
}

function customArgsSelectSubtitles(ytdlpCustomArgs) {
  if (!ytdlpCustomArgs) return false;
  const check = checkCustomArgs(ytdlpCustomArgs);
  // Unparseable or otherwise invalid custom args: the builder drops them too,
  // but stay on the safe side and keep every subtitle file.
  if (check.errors.length > 0) return true;
  return check.args.some((token) => SUBTITLE_SELECTION_CANONICAL.has(token));
}

/**
 * Decide which downloaded .srt sidecars to delete so that each selected
 * language keeps its uploaded track(s), or a single auto-generated track when
 * nothing was uploaded.
 *
 * A selected bare code is sent to yt-dlp expanded to its regional and script
 * variants, and yt-dlp picks from uploaded and auto-generated tracks in one
 * list keyed by exact code. It therefore cannot prefer an uploaded "en-GB"
 * over the auto-generated "en", and YouTube's machine translations include
 * "pt-PT" next to "pt", so a video can end up with two or three tracks for
 * one language. Per language whose bare code was configured:
 * - an uploaded track was written: its auto-generated tracks are dropped;
 * - nothing uploaded but the bare auto track was written: the other
 *   auto-generated variants are dropped;
 * - otherwise every track is kept.
 * A code the user listed verbatim (en-orig, pt-BR) is never dropped but still
 * counts as an uploaded track when it is one. Nothing is pruned when any
 * configured entry is an alias, exclusion or regex, when the custom yt-dlp
 * args choose subtitle languages themselves, when the uploaded codes are
 * unknown (no `subtitles` object in the info.json), and other videos' files
 * in a flat channel folder are never touched.
 *
 * @param {Object} params
 * @param {string[]} params.fileNames - Names of the files in the video's folder
 * @param {string} params.youtubeId - The video's YouTube id
 * @param {string[]|undefined} params.uploadedCodes - Keys of the info.json `subtitles` object
 * @param {string|null} params.subtitleLanguage - The configured language list
 * @param {string|null} [params.ytdlpCustomArgs] - The configured custom yt-dlp args
 * @returns {string[]} - File names to delete
 */
function selectSubtitleFilesToPrune({ fileNames, youtubeId, uploadedCodes, subtitleLanguage, ytdlpCustomArgs }) {
  if (!youtubeId || !Array.isArray(fileNames) || !Array.isArray(uploadedCodes)) {
    return [];
  }

  const entries = parseSubtitleLanguages(subtitleLanguage);
  if (!entries.every(isPlainLanguageCode) || customArgsSelectSubtitles(ytdlpCustomArgs)) {
    return [];
  }

  const prunableLanguages = new Set(
    entries.filter(isExpandableLanguageCode).map((entry) => entry.toLowerCase())
  );
  const protectedCodes = new Set(
    entries.filter((entry) => !isExpandableLanguageCode(entry)).map((entry) => entry.toLowerCase())
  );
  const uploaded = new Set(uploadedCodes.map((code) => String(code).toLowerCase()));

  const tracksByLanguage = new Map();
  for (const fileName of fileNames) {
    if (!isFileForVideo(fileName, youtubeId)) continue;
    const match = fileName.match(SUBTITLE_SIDECAR_CODE);
    if (!match) continue;
    const code = match[1].toLowerCase();
    const language = baseLanguage(code);
    if (!prunableLanguages.has(language)) continue;
    if (!tracksByLanguage.has(language)) tracksByLanguage.set(language, []);
    tracksByLanguage.get(language).push({
      fileName,
      code,
      uploaded: uploaded.has(code),
      deletable: !uploaded.has(code) && !protectedCodes.has(code),
    });
  }

  const toPrune = [];
  for (const [language, tracks] of tracksByLanguage) {
    const deletable = tracks.filter((track) => track.deletable);
    if (tracks.some((track) => track.uploaded)) {
      toPrune.push(...deletable.map((track) => track.fileName));
      continue;
    }
    if (tracks.some((track) => track.code === language)) {
      toPrune.push(...deletable.filter((track) => track.code !== language).map((track) => track.fileName));
    }
  }
  return toPrune;
}

module.exports = { selectSubtitleFilesToPrune };
