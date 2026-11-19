// The carrier NZB. A search result's download link carries the video id and
// the release title, the NZB Sonarr or Radarr fetches from it repeats them in
// its <head>, and the app uploads that NZB back when it grabs. Nothing is
// stored between search and grab, so every field is validated again on the
// way in. Whoever holds the key can already request any video, so the fields
// are not signed.
const { escapeXml } = require('../feeds/rssWriter');
const { KINDS } = require('./arrBridgeConfig');
const { isValidReleaseTitle } = require('./releaseNaming');

const MAX_NZB_BYTES = 64 * 1024;
// The id of the item that keeps the no-query feed non-empty. Never a video.
const PLACEHOLDER_ID = 'placeholder';
const NZB_SUFFIX = '.nzb';
const META_PREFIX = 'youtarr-';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SIZE_PATTERN = /^\d{1,13}$/;
const META_PATTERN = /<meta type="youtarr-(id|kind|title|date|size)">([^<]*)<\/meta>/g;

/**
 * @param {Object} raw - { id, kind, title, date, size } as strings
 * @returns {{youtubeId: string, kind: string, releaseTitle: string, uploadDate: Date,
 *   estimatedBytes: number}|null} Null when any field is not acceptable
 */
function validateGrabFields(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { id, kind, title, date, size } = raw;
  if (typeof id !== 'string' || !YOUTUBE_ID_PATTERN.test(id) || id === PLACEHOLDER_ID) return null;
  if (!KINDS.includes(kind) || !isValidReleaseTitle(title)) return null;
  if (typeof date !== 'string' || !ISO_DATE_PATTERN.test(date)) return null;
  const uploadDate = new Date(date);
  if (Number.isNaN(uploadDate.getTime())) return null;
  if (size !== undefined && (typeof size !== 'string' || !SIZE_PATTERN.test(size))) return null;
  return {
    youtubeId: id,
    kind,
    releaseTitle: title,
    uploadDate,
    estimatedBytes: size === undefined ? 0 : Number(size),
  };
}

const toRaw = (fields) => ({
  id: fields.youtubeId,
  kind: fields.kind,
  title: fields.releaseTitle,
  date: new Date(fields.uploadDate).toISOString(),
  size: String(fields.estimatedBytes || 0),
});

/**
 * The key is part of the link because Sonarr and Radarr fetch it as given.
 * @param {string} origin - Scheme and host the client used
 * @param {Object} fields - Validated grab fields
 * @param {string} apiKey
 * @returns {string}
 */
function buildNzbLink(origin, fields, apiKey) {
  const raw = toRaw(fields);
  const params = new URLSearchParams({ id: raw.id, kind: raw.kind, date: raw.date, size: raw.size, apikey: apiKey });
  return `${origin}/arr/newznab/nzb/${encodeURIComponent(raw.title)}${NZB_SUFFIX}?${params}`;
}

/**
 * @param {unknown} fileParam - The decoded last path segment, "<title>.nzb"
 * @param {Object} query - req.query
 * @returns {Object|null} Validated grab fields
 */
function parseNzbLink(fileParam, query) {
  if (typeof fileParam !== 'string' || !fileParam.endsWith(NZB_SUFFIX) || !query) return null;
  return validateGrabFields({
    id: query.id,
    kind: query.kind,
    title: fileParam.slice(0, -NZB_SUFFIX.length),
    date: query.date,
    size: query.size,
  });
}

/**
 * A minimal valid NZB: one file with one segment is all the apps check.
 * @param {Object} fields - Validated grab fields
 * @returns {string}
 */
function buildNzb(fields) {
  const raw = toRaw(fields);
  const metas = Object.entries(raw).map(
    ([name, value]) => `    <meta type="${META_PREFIX}${name}">${escapeXml(value)}</meta>`
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">',
    '  <head>',
    ...metas,
    '  </head>',
    `  <file poster="youtarr" date="${Math.floor(new Date(fields.uploadDate).getTime() / 1000)}" subject="${escapeXml(raw.title)}">`,
    '    <groups><group>youtarr</group></groups>',
    `    <segments><segment bytes="1" number="1">${escapeXml(raw.id)}@youtarr</segment></segments>`,
    '  </file>',
    '</nzb>',
    '',
  ].join('\n');
}

const unescapeXml = (text) => text
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, '\'')
  .replace(/&amp;/g, '&');

/**
 * @param {unknown} input - The uploaded NZB, as text or a Buffer
 * @returns {Object|null} Validated grab fields, or null when it is not one of ours
 */
function parseNzb(input) {
  if (Buffer.isBuffer(input)) {
    if (input.length > MAX_NZB_BYTES) return null;
    return parseNzb(input.toString('utf8'));
  }
  if (typeof input !== 'string' || input.length === 0 || Buffer.byteLength(input, 'utf8') > MAX_NZB_BYTES) {
    return null;
  }
  const raw = {};
  for (const match of input.matchAll(META_PATTERN)) raw[match[1]] = unescapeXml(match[2]);
  return validateGrabFields(raw);
}

module.exports = {
  MAX_NZB_BYTES,
  PLACEHOLDER_ID,
  validateGrabFields,
  buildNzbLink,
  parseNzbLink,
  buildNzb,
  parseNzb,
};
