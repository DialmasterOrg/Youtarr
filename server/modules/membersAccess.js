const fs = require('fs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const logger = require('../logger');
const configModule = require('./configModule');
const { getExternalCookiesPath, readExternalCookies } = require('./externalCookies');
// Model files, not the models index: downloadModule.test.js replaces model
// files with plain objects and the index's association setup throws on them.
const VideoMembersAccess = require('../models/videomembersaccess');
const ChannelVideo = require('../models/channelvideo');

// A verdict is re-checked after this long, so a membership that was bought or
// lapsed is noticed without the user doing anything.
const ACCESS_TTL_MS = 24 * 60 * 60 * 1000;
// Upper bound on the ids put into one yt-dlp match filter. Linux limits one
// argument to 128 KiB and each id costs 12 characters.
const MAX_FILTERED_DENIALS = 5000;
const MEMBERS_ONLY_AVAILABILITY = 'subscriber_only';

const ACCESS = Object.freeze({
  CONFIRMED: 'confirmed',
  DENIED: 'denied',
});

// What the client is told about a members-only video.
const STATE = Object.freeze({
  NO_COOKIES: 'no_cookies',
  UNCHECKED: 'unchecked',
  CONFIRMED: 'confirmed',
  DENIED: 'denied',
});

// yt-dlp prints this when YouTube rejected the cookies. YouTube then answers a
// members-only video with the same "Join this channel" error a non-member gets,
// so that error says nothing about the account's membership.
const COOKIES_REJECTED_PATTERNS = [
  /cookies are no longer valid/i,
  /cookies.*rotated/i,
];

function isCookiesRejected(output = '') {
  const text = String(output);
  return COOKIES_REJECTED_PATTERNS.some((pattern) => pattern.test(text));
}

function isBlockedState(state) {
  return state === STATE.NO_COOKIES || state === STATE.DENIED;
}

function uniqueIds(ids) {
  return [...new Set((ids || []).filter((id) => typeof id === 'string' && id))];
}

class MembersAccess {
  constructor() {
    this.keyCache = null;
  }

  /**
   * Identifies the configured cookies. Computed once per call site and passed
   * around, never per row: hashing an external file means reading it.
   * @returns {{ cookiesConfigured: boolean, cookieKey: string|null }}
   */
  getContext() {
    const cookiesPath = configModule.getCookiesPath();
    if (!cookiesPath) return { cookiesConfigured: false, cookieKey: null };
    return { cookiesConfigured: true, cookieKey: this.computeCookieKey(cookiesPath) };
  }

  // Memoized by path, size and mtime so an unchanged file is not re-read; an
  // edited or replaced file gets a new key, which retires every verdict made
  // with the old one. Null when the file cannot be read.
  computeCookieKey(cookiesPath) {
    try {
      const stat = fs.statSync(cookiesPath);
      const cached = this.keyCache;
      if (cached && cached.path === cookiesPath && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
        return cached.key;
      }
      const contents = cookiesPath === getExternalCookiesPath()
        ? readExternalCookies(cookiesPath).contents
        : fs.readFileSync(cookiesPath);
      const key = crypto.createHash('sha256').update(contents).digest('hex');
      this.keyCache = { path: cookiesPath, size: stat.size, mtimeMs: stat.mtimeMs, key };
      return key;
    } catch (err) {
      logger.debug({ code: err.code }, 'Could not read cookie file for members-only access');
      return null;
    }
  }

  /**
   * @param {Object|null} record - VideoMembersAccess row
   * @param {{ cookiesConfigured: boolean, cookieKey: string|null }} context
   * @param {number} [nowMs]
   * @returns {string} one of STATE
   */
  describe(record, context, nowMs = Date.now()) {
    if (!context.cookiesConfigured) return STATE.NO_COOKIES;
    if (!record || !record.access || !context.cookieKey || record.cookie_key !== context.cookieKey) {
      return STATE.UNCHECKED;
    }
    const checkedAt = record.checked_at ? new Date(record.checked_at).getTime() : NaN;
    if (!Number.isFinite(checkedAt) || nowMs - checkedAt >= ACCESS_TTL_MS) return STATE.UNCHECKED;
    return record.access === ACCESS.CONFIRMED ? STATE.CONFIRMED : STATE.DENIED;
  }

  /**
   * Access state for every members-only video among the given ids. A video is
   * members-only when its listing row says so or Youtarr has recorded it.
   * @param {string[]} youtubeIds
   * @param {Object} [options]
   * @param {Set<string>} [options.knownMembersOnly] - ids the caller already knows are members-only
   * @param {Object} [options.context] - from getContext()
   * @returns {Promise<Map<string, string>>} youtube id -> state
   */
  async getStates(youtubeIds, { knownMembersOnly = new Set(), context = this.getContext() } = {}) {
    const ids = uniqueIds(youtubeIds);
    const states = new Map();
    if (ids.length === 0) return states;

    const records = await VideoMembersAccess.findAll({ where: { youtube_id: ids }, raw: true });
    const recordById = new Map(records.map((record) => [record.youtube_id, record]));

    const unknownIds = ids.filter((id) => !knownMembersOnly.has(id) && !recordById.has(id));
    const listedMembersOnly = new Set(knownMembersOnly);
    if (unknownIds.length > 0) {
      const rows = await ChannelVideo.findAll({
        where: { youtube_id: unknownIds, availability: MEMBERS_ONLY_AVAILABILITY },
        attributes: ['youtube_id'],
        raw: true,
      });
      rows.forEach((row) => listedMembersOnly.add(row.youtube_id));
    }

    const nowMs = Date.now();
    for (const id of ids) {
      const record = recordById.get(id) || null;
      if (!record && !listedMembersOnly.has(id)) continue;
      states.set(id, this.describe(record, context, nowMs));
    }
    return states;
  }

  /**
   * Members-only videos the configured cookies were denied within the TTL,
   * newest first.
   * @param {{ cookiesConfigured: boolean, cookieKey: string|null }} context
   * @returns {Promise<string[]>}
   */
  async getFreshDeniedIds(context) {
    if (!context.cookiesConfigured || !context.cookieKey) return [];
    const rows = await VideoMembersAccess.findAll({
      where: {
        access: ACCESS.DENIED,
        cookie_key: context.cookieKey,
        checked_at: { [Op.gt]: new Date(Date.now() - ACCESS_TTL_MS) },
      },
      attributes: ['youtube_id'],
      order: [['checked_at', 'DESC']],
      limit: MAX_FILTERED_DENIALS,
      raw: true,
    });
    return rows.map((row) => row.youtube_id);
  }

  /**
   * The members-only part of a download's yt-dlp match filter. Without cookies
   * members-only videos are filtered out, as before. With cookies they are
   * attempted, except those already denied, unless the user asked for them.
   * @param {Object} options
   * @param {boolean} options.cookiesEnabled - this run passes cookies to yt-dlp
   * @param {boolean} [options.skipDenied] - leave out fresh denials
   * @returns {Promise<string|null>} filter clause, or null for none
   */
  async buildDownloadFilter({ cookiesEnabled, skipDenied = true }) {
    if (!cookiesEnabled) return `availability!=${MEMBERS_ONLY_AVAILABILITY}`;
    if (!skipDenied) return null;
    try {
      const deniedIds = await this.getFreshDeniedIds(this.getContext());
      if (deniedIds.length === 0) return null;
      // Video ids are [A-Za-z0-9_-]{11}; nothing in them needs escaping.
      return `id!~='^(?:${deniedIds.join('|')})$'`;
    } catch (err) {
      // Failing open costs one extra attempt per denied video, not a download.
      logger.warn({ err }, 'Could not read members-only denials; attempting every members-only video');
      return null;
    }
  }

  /**
   * Records that the configured cookies could (confirmed) or could not
   * (denied) open these members-only videos.
   * @param {string[]} youtubeIds
   * @param {string} access - ACCESS.CONFIRMED or ACCESS.DENIED
   * @param {{ cookieKey: string|null }} context
   */
  async recordVerdict(youtubeIds, access, context) {
    const ids = uniqueIds(youtubeIds);
    if (ids.length === 0 || !context.cookieKey) return;
    const checkedAt = new Date();
    await VideoMembersAccess.bulkCreate(
      ids.map((youtubeId) => ({ youtube_id: youtubeId, access, cookie_key: context.cookieKey, checked_at: checkedAt })),
      { updateOnDuplicate: ['access', 'cookie_key', 'checked_at'] }
    );
  }

  // Remembers that these videos are members-only without judging the account,
  // keeping any verdict already on record.
  async recordMembersOnly(youtubeIds) {
    const ids = uniqueIds(youtubeIds);
    if (ids.length === 0) return;
    await VideoMembersAccess.bulkCreate(
      ids.map((youtubeId) => ({ youtube_id: youtubeId, access: null, cookie_key: null, checked_at: null })),
      { ignoreDuplicates: true }
    );
  }

  // A user asking for these videos again wants a fresh check, not a cached denial.
  async clearVerdicts(youtubeIds) {
    const ids = uniqueIds(youtubeIds);
    if (ids.length === 0) return;
    await VideoMembersAccess.update(
      { access: null, cookie_key: null, checked_at: null },
      { where: { youtube_id: ids } }
    );
  }

  /**
   * Turns a metadata fetch's outcome into a state and records it. Never
   * throws: a failed write only means the video is checked again later.
   * @param {string} youtubeId
   * @param {Object} outcome
   * @param {string|null} [outcome.availability] - from a successful fetch
   * @param {string|null} [outcome.errorMessage] - from a fetch yt-dlp refused as members-only (its stderr)
   * @returns {Promise<string|null>} the video's state, or null when it is not members-only
   */
  async recordFetchOutcome(youtubeId, { availability = null, errorMessage = null } = {}) {
    const context = this.getContext();
    const { state, verdict } = this.judgeFetch(context, { availability, errorMessage });
    if (state === null) return null;
    try {
      if (verdict) {
        await this.recordVerdict([youtubeId], verdict, context);
      } else {
        await this.recordMembersOnly([youtubeId]);
      }
    } catch (err) {
      logger.warn({ err, youtubeId }, 'Could not record members-only access');
    }
    return state;
  }

  // The state a fetch shows, and the verdict to record (none when the fetch
  // says nothing about the account's membership).
  judgeFetch(context, { availability, errorMessage }) {
    const failed = errorMessage !== null && errorMessage !== undefined;
    if (!failed && availability !== MEMBERS_ONLY_AVAILABILITY) return { state: null, verdict: null };
    if (!context.cookiesConfigured) return { state: STATE.NO_COOKIES, verdict: null };
    // Rejected cookies get the same "Join this channel" answer as a non-member.
    if (!context.cookieKey || (failed && isCookiesRejected(errorMessage))) {
      return { state: STATE.UNCHECKED, verdict: null };
    }
    // A successful read proves the cookies it ran with can open the video.
    return failed
      ? { state: STATE.DENIED, verdict: ACCESS.DENIED }
      : { state: STATE.CONFIRMED, verdict: ACCESS.CONFIRMED };
  }

  /**
   * Records what a download run learned. Denials count only for a run that
   * passed the configured cookies and did not have them rejected; downloads of
   * members-only videos confirm access.
   * @param {Object} outcome
   * @param {Iterable<string>} outcome.membersOnlyIds - videos yt-dlp refused as members-only
   * @param {string[]} outcome.downloadedIds - videos that downloaded
   * @param {boolean} outcome.usedCookies - the run passed the configured cookies
   * @param {string} [outcome.stderr] - the run's stderr
   */
  async recordDownloadOutcome({ membersOnlyIds, downloadedIds, usedCookies, stderr = '' }) {
    const refused = uniqueIds([...(membersOnlyIds || [])]);
    const downloaded = uniqueIds(downloadedIds);
    if (refused.length === 0 && downloaded.length === 0) return;

    const context = this.getContext();
    const canJudge = usedCookies && context.cookiesConfigured && Boolean(context.cookieKey);

    if (refused.length > 0) {
      if (canJudge && !isCookiesRejected(stderr)) {
        await this.recordVerdict(refused, ACCESS.DENIED, context);
      } else {
        await this.recordMembersOnly(refused);
      }
    }

    if (canJudge && downloaded.length > 0) {
      const states = await this.getStates(downloaded, { context });
      await this.recordVerdict([...states.keys()], ACCESS.CONFIRMED, context);
    }
  }
}

const membersAccess = new MembersAccess();
membersAccess.STATE = STATE;
membersAccess.ACCESS = ACCESS;
membersAccess.ACCESS_TTL_MS = ACCESS_TTL_MS;
membersAccess.MAX_FILTERED_DENIALS = MAX_FILTERED_DENIALS;
membersAccess.isBlockedState = isBlockedState;
membersAccess.isCookiesRejected = isCookiesRejected;

module.exports = membersAccess;
