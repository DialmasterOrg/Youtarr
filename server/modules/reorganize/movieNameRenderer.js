/**
 * Movie-style names for videos that leave a TV folder: the channel folder,
 * the per-video folder and the file stem a fresh download would get today,
 * rendered by yt-dlp from each video's stored info.json against the global
 * filename template. Many videos render in one yt-dlp process (it accepts a
 * JSON array), offline.
 *
 * yt-dlp re-selects formats from a loaded info dict, so %(ext)s can differ
 * from the file on disk; only the stem is rendered and each file keeps its
 * own suffix.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const configModule = require('../configModule');
const ytDlpRunner = require('../ytDlpRunner');
const logger = require('../../logger');
const { CHANNEL_TEMPLATE, composeVideoFolderName, composeThumbnailFilename } = require('../filesystem/constants');
const YtdlpCommandBuilder = require('../download/ytdlpCommandBuilder');

const BATCH_SIZE = 200;
const RENDER_TIMEOUT_MS = 120000;
// Large parts of an info dict that no filename template uses.
const STRIPPED_FIELDS = [
  'formats', 'thumbnails', 'automatic_captions', 'subtitles', 'heatmap', 'requested_formats',
  'requested_subtitles', 'requested_downloads', 'fragments', 'chapters',
];
// Custom yt-dlp args that change file names, with their value counts; passed
// on so a rendered name matches what a download writes.
const NAME_ARG_ARITY = {
  '--restrict-filenames': 0,
  '--no-restrict-filenames': 0,
  '--windows-filenames': 0,
  '--no-windows-filenames': 0,
  '--trim-filenames': 1,
  '--trim-file-names': 1,
  '--output-na-placeholder': 1,
  '--replace-in-metadata': 3,
  '--parse-metadata': 2,
};

/**
 * The name-changing part of the user's custom yt-dlp args.
 * @param {string[]} tokens
 * @returns {string[]}
 */
function nameAffectingArgs(tokens) {
  const picked = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const eq = token.startsWith('--') ? token.indexOf('=') : -1;
    const flag = eq >= 0 ? token.slice(0, eq) : token;
    if (!Object.prototype.hasOwnProperty.call(NAME_ARG_ARITY, flag)) continue;
    const valueCount = eq >= 0 ? 0 : NAME_ARG_ARITY[flag];
    picked.push(...tokens.slice(i, i + 1 + valueCount));
    i += valueCount;
  }
  return picked;
}

function renderTemplate(prefix) {
  return [CHANNEL_TEMPLATE, composeVideoFolderName(prefix), composeThumbnailFilename(prefix)].join('/');
}

function strippedInfo(info) {
  const copy = { ...info };
  for (const field of STRIPPED_FIELDS) delete copy[field];
  return copy;
}

function renderArgs(batchFile, template, customArgs) {
  return [
    '--no-update',
    '--load-info-json', batchFile,
    '--ignore-no-formats-error',
    '--simulate',
    '--skip-download',
    // The naming options every download passes (ytdlpCommandBuilder).
    '--windows-filenames',
    '--output-na-placeholder', 'Unknown Channel',
    '--replace-in-metadata', 'uploader_id', '^@', '',
    ...customArgs,
    '--quiet',
    '--no-warnings',
    '--print', '%(id)s',
    '--print', 'filename',
    '-o', template,
  ];
}

// yt-dlp prints each entry's id line, then its rendered path.
function parseOutput(stdout, ids) {
  const results = new Map();
  const lines = stdout.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    const id = lines[i].trim();
    if (!ids.has(id) || results.has(id)) continue;
    const segments = lines[i + 1].split('/');
    if (segments.length !== 3 || !segments[2].endsWith(`[${id}]`)) continue;
    results.set(id, { channelFolder: segments[0], videoFolder: segments[1], stem: segments[2] });
    i += 1;
  }
  return results;
}

async function renderBatch(entries, template, customArgs, workDir) {
  const batchFile = path.join(workDir, `batch-${entries[0].youtubeId}.json`);
  await fs.promises.writeFile(batchFile, JSON.stringify(entries.map((entry) => strippedInfo(entry.info))));
  try {
    const stdout = await ytDlpRunner.run(renderArgs(batchFile, template, customArgs), { timeoutMs: RENDER_TIMEOUT_MS });
    return parseOutput(stdout, new Set(entries.map((entry) => entry.youtubeId)));
  } catch (err) {
    // One bad info dict fails the whole process: split until it is isolated.
    if (entries.length === 1) {
      logger.warn({ err, youtubeId: entries[0].youtubeId }, 'Could not render the movie-style file name');
      return new Map();
    }
    const half = Math.ceil(entries.length / 2);
    const [first, second] = await Promise.all([
      renderBatch(entries.slice(0, half), template, customArgs, workDir),
      renderBatch(entries.slice(half), template, customArgs, workDir),
    ]);
    return new Map([...first, ...second]);
  } finally {
    await fs.promises.rm(batchFile, { force: true });
  }
}

/**
 * Render movie-style names for videos.
 *
 * @param {Array<{youtubeId: string, info: Object}>} entries
 * @returns {Promise<Map<string, {channelFolder: string, videoFolder: string, stem: string}>>}
 *   Videos missing from the map could not be rendered
 */
async function renderMovieNames(entries) {
  const results = new Map();
  if (entries.length === 0) return results;
  const config = configModule.getConfig() || {};
  const template = renderTemplate(config.videoFilenamePrefix);
  const customArgs = nameAffectingArgs(YtdlpCommandBuilder.buildCustomArgs(config));
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'youtarr-names-'));
  try {
    for (let start = 0; start < entries.length; start += BATCH_SIZE) {
      const rendered = await renderBatch(entries.slice(start, start + BATCH_SIZE), template, customArgs, workDir);
      for (const [id, names] of rendered) results.set(id, names);
    }
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  }
  return results;
}

module.exports = {
  renderMovieNames,
  nameAffectingArgs,
  renderTemplate,
  parseOutput
};
