// Builds the release titles Sonarr and Radarr parse. A title comes from what
// the client asked for, never from the video's own title: tokens such as E05,
// 720p or German in a YouTube title change the parsed episode, quality or
// language. The uploader's channel name is the only video-derived part.
const { sanitizeNameLikeYtDlp } = require('../filesystem/sanitizer');

const DEFAULT_GROUP = 'YOUTARR';
const MAX_SERIES_TOKEN_LENGTH = 60;
const MAX_GROUP_LENGTH = 30;
// The title is also a folder and a file name; this leaves room for an extension.
const MAX_TITLE_BYTES = 240;
const DEFAULT_RESOLUTION = 1080;

const APOSTROPHES = /['’‘ʼ`]/g;
const LATIN_WITH_MARKS = /(\p{Script=Latin})\p{M}+/gu;
const NON_NAME_CHARACTERS = /[^\p{L}\p{N}\p{M}]+/gu;
const VALID_TITLE = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}.-]*$/u;
// Sonarr rejects a release whose title contains "sample" when it is small,
// and the feed always reports size 0.
const SAMPLE_WORD = /sample/gi;
const RESOLUTION_TOKEN = /\d{3,4}[pi]/i;

// Sonarr reads a source, a language or a revision out of the release group,
// and Radarr an edition, so a channel name containing one is not used.
const DENIED_GROUP_WORDS = [
  'hdtv', 'pdtv', 'sdtv', 'bluray', 'bdrip', 'brrip', 'dvd', 'webrip', 'webdl', 'hdrip', 'remux',
  'xvid', 'x264', 'x265', 'h264', 'h265', 'hevc', '4k', 'uhd', 'hdr',
  'proper', 'repack', 'rerip', 'sample',
  'german', 'french', 'spanish', 'italian', 'russian', 'japanese', 'chinese', 'korean', 'hindi',
  'dutch', 'flemish', 'portuguese', 'polish', 'swedish', 'norwegian', 'danish', 'finnish',
  'icelandic', 'turkish', 'arabic', 'hebrew', 'greek', 'czech', 'slovak', 'hungarian', 'romanian',
  'bulgarian', 'ukrainian', 'croatian', 'serbian', 'lithuanian', 'latvian', 'thai', 'vietnamese',
  'indonesian', 'malay', 'persian', 'bengali', 'tamil', 'telugu', 'malayalam', 'kannada', 'urdu',
];
const DENIED_MOVIE_GROUP_WORDS = [
  'remastered', 'extended', 'directors', 'uncut', 'unrated', 'theatrical', 'imax',
  'restoration', 'restored', 'anniversary', 'edition', 'criterion', 'special',
];
const DENIED_GROUP_CODES = new Set([
  'eng', 'ger', 'fre', 'spa', 'ita', 'rus', 'jap', 'jpn', 'chi', 'kor', 'hin', 'nl',
  'hd', 'sd', 'web', 'dl',
]);

// Removes accents from Latin letters only: stripping the marks of other
// scripts would change the letters themselves.
function foldLatinAccents(text) {
  return String(text ?? '').normalize('NFD').replace(LATIN_WITH_MARKS, '$1').normalize('NFC');
}

const collapseDots = (text) => text.replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');

/**
 * The series or movie text as a dotted token. Each rule was checked against
 * the real Sonarr and Radarr parsers.
 * @param {unknown} text
 * @returns {string} Possibly empty
 */
function seriesToken(text) {
  const dotted = collapseDots(
    foldLatinAccents(text)
      .replace(APOSTROPHES, '')
      .replace(NON_NAME_CHARACTERS, '.')
      .replace(SAMPLE_WORD, '')
  );
  if (dotted.length <= MAX_SERIES_TOKEN_LENGTH) return dotted;
  const cut = dotted.slice(0, MAX_SERIES_TOKEN_LENGTH);
  const endsOnBoundary = dotted[MAX_SERIES_TOKEN_LENGTH] === '.';
  const lastDot = cut.lastIndexOf('.');
  return collapseDots(endsOnBoundary || lastDot <= 0 ? cut : cut.slice(0, lastDot));
}

/**
 * The uploader's channel name as a release group.
 * @param {unknown} channelName
 * @param {'tv'|'movie'} kind
 * @returns {string}
 */
function groupToken(channelName, kind) {
  const group = foldLatinAccents(channelName).replace(/[^A-Za-z0-9]/g, '').slice(0, MAX_GROUP_LENGTH);
  if (!group || /^\d+$/.test(group)) return DEFAULT_GROUP;
  const lower = group.toLowerCase();
  if (DENIED_GROUP_CODES.has(lower) || RESOLUTION_TOKEN.test(lower)) return DEFAULT_GROUP;
  if (DENIED_GROUP_WORDS.some((word) => lower.includes(word))) return DEFAULT_GROUP;
  if (kind === 'movie' && DENIED_MOVIE_GROUP_WORDS.some((word) => lower.includes(word))) return DEFAULT_GROUP;
  return group;
}

/**
 * The resolution to label a release with. 1440 would parse as 1080, and
 * anything under 720 as 480.
 * @param {unknown} preferredResolution - The preferredResolution setting
 * @returns {480|720|1080|2160}
 */
function resolutionLabel(preferredResolution) {
  const height = Number.parseInt(preferredResolution, 10);
  if (!Number.isFinite(height)) return DEFAULT_RESOLUTION;
  if (height >= 2160) return 2160;
  if (height >= 1080) return 1080;
  if (height >= 720) return 720;
  return 480;
}

// The last one counts: a series can be named after a resolution.
const TITLE_RESOLUTION = /^.*\.(480|720|1080|2160)p\.WEB-DL-/;

/**
 * @param {unknown} releaseTitle - A title this module built
 * @returns {string|null} The resolution it was labeled with ('1080'), or null
 */
function resolutionOfTitle(releaseTitle) {
  return TITLE_RESOLUTION.exec(typeof releaseTitle === 'string' ? releaseTitle : '')?.[1] ?? null;
}

const pad2 = (value) => String(value).padStart(2, '0');

// Sonarr removes a leading "The" from q, and a release named from the rest
// matches no series. It tries both halves of an AKA name, so this matches
// with or without the article. A title parameter arrives untouched.
function tvSeriesName(text, textSource) {
  const token = seriesToken(text);
  if (!token) return null;
  if (textSource !== 'q' || /^the(\.|$)/i.test(token)) return token;
  return `${token}.AKA.The.${token}`;
}

const finish = (title) => (isValidReleaseTitle(title) ? title : null);

/**
 * @returns {string|null} Null when the text gives no usable name
 */
function buildTvTitle({ text, textSource, season, episode, resolution, group }) {
  const name = tvSeriesName(text, textSource);
  if (!name) return null;
  return finish(`${name}.S${pad2(season)}E${pad2(episode)}.${resolution}p.WEB-DL-${group}`);
}

function buildDailyTitle({ text, textSource, year, month, day, resolution, group }) {
  const name = tvSeriesName(text, textSource);
  if (!name) return null;
  return finish(`${name}.${year}.${pad2(month)}.${pad2(day)}.${resolution}p.WEB-DL-${group}`);
}

function buildMovieTitle({ title, year, resolution, group }) {
  const name = seriesToken(title);
  if (!name) return null;
  return finish(`${name}.${year}.${resolution}p.WEB-DL-${group}`);
}

/**
 * Whether a string is safe to use as a release title, which is also a folder
 * name and a file name.
 * @param {unknown} title
 * @returns {boolean}
 */
function isValidReleaseTitle(title) {
  if (typeof title !== 'string' || !VALID_TITLE.test(title)) return false;
  if (title.includes('..') || Buffer.byteLength(title, 'utf8') > MAX_TITLE_BYTES) return false;
  return sanitizeNameLikeYtDlp(title) === title;
}

module.exports = {
  DEFAULT_GROUP,
  foldLatinAccents,
  seriesToken,
  groupToken,
  resolutionLabel,
  resolutionOfTitle,
  buildTvTitle,
  buildDailyTitle,
  buildMovieTitle,
  isValidReleaseTitle,
};
