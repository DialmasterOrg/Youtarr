'use strict';

const { extractSubfolderFromAbsPath } = require('../../server/modules/filesystem/pathBuilder');

const SENTINELS = new Set(['##USE_GLOBAL_DEFAULT##', '##ROOT##']);

// Approximate utf8mb4_unicode_ci for the in-JS first-pass dedupe: lowercase +
// strip combining diacritics. The DB unique index (with ignoreDuplicates) is the
// real guard; this only keeps the insert list tidy.
function foldKey(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function isRealName(value) {
  return typeof value === 'string' && value.trim() !== '' && !SENTINELS.has(value.trim());
}

/**
 * @param {{ channelSubFolders: Array<string|null>, playlistSubFolders: Array<string|null>,
 *           videoPaths: Array<string|null>, baseDir: string }} sources
 * @returns {string[]} clean, deduped subfolder names (first-seen casing preserved)
 */
function collectBackfillNames({ channelSubFolders, playlistSubFolders, videoPaths, baseDir }) {
  const seen = new Map(); // foldKey -> original
  const add = (raw) => {
    if (!isRealName(raw)) return;
    const name = raw.trim();
    const key = foldKey(name);
    if (!seen.has(key)) seen.set(key, name);
  };

  (channelSubFolders || []).forEach(add);
  (playlistSubFolders || []).forEach(add);
  (videoPaths || []).forEach((p) => add(extractSubfolderFromAbsPath(p, baseDir)));

  return Array.from(seen.values());
}

module.exports = { collectBackfillNames, foldKey, isRealName };
