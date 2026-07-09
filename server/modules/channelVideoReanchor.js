const { Op } = require('sequelize');
const { sequelize } = require('../db');
const ChannelVideo = require('../models/channelvideo');
const logger = require('../logger');
const { PUBLISHED_AT_SOURCE } = require('./constants/publishedAtSource');

// Step between consecutive synthetic dates when there is no lower bound to
// interpolate against (a run of undated videos at the oldest end of the list).
const FALLBACK_STEP_MS = 1000;

/**
 * Keeps channelvideos rows in YouTube/yt-dlp order when an authoritative
 * (.info.json) "exact" date is written out of band - i.e. by the video modal
 * opening or a download completing, which bypass the fetch-time anchoring in
 * channelModule.insertVideosIntoDb.
 *
 * An exact date dropped into the middle of a cluster of approximate/estimated
 * dates would, on the next server-side sort, jump the video out of its real
 * position (e.g. an exact 5/7 sinks below sibling videos still labelled ~5/12).
 * This module re-derives the surrounding synthetic dates so a publishedAt sort
 * preserves the existing order, never touching YouTube - all the ordering
 * information is already in the current row order.
 *
 * Date provenance is preserved: exact stays exact (and immovable), approximate
 * stays approximate, estimated stays estimated. Only the date VALUES of
 * non-exact rows are adjusted, and only where ordering requires it.
 */
class ChannelVideoReanchorModule {
  /**
   * Pure ordering core. Given rows already in YouTube order (newest first),
   * returns a strictly-descending array of epoch-ms dates that preserves that
   * order. Exact dates are immovable anchors; approximate/legacy dates are kept
   * as anchors while they stay consistent and reassigned when they would break
   * order; estimated (and dateless) rows are always reassigned. Reassigned runs
   * are interpolated evenly between their bounding anchors so the synthetic
   * guesses land as close as possible to the real dates.
   *
   * @param {Array<{ms: number|null, source: string|null}>} rows - newest first
   * @param {number} nowMs - upper bound for a flexible run at the newest end
   * @returns {number[]} new epoch-ms date for each row, same order
   */
  computeReanchoredDates(rows, nowMs) {
    const n = rows.length;
    if (n === 0) return [];

    // Pass 1: mark anchors (kept dates) vs flexible rows (to be reassigned).
    const fixed = new Array(n).fill(null);
    let lastFixed = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      if (r.source === PUBLISHED_AT_SOURCE.EXACT && r.ms != null) {
        // Authoritative: always an anchor, even in the rare case its date
        // contradicts an anchor above it.
        fixed[i] = r.ms;
        lastFixed = Math.min(lastFixed, r.ms);
      } else if (r.source !== PUBLISHED_AT_SOURCE.ESTIMATED && r.ms != null && r.ms < lastFixed) {
        // Approximate or legacy (null source) date that is still consistent.
        fixed[i] = r.ms;
        lastFixed = r.ms;
      } else {
        fixed[i] = null;
      }
    }

    // Pass 2: fill flexible runs by interpolating between bounding anchors.
    const result = new Array(n);
    let i = 0;
    while (i < n) {
      if (fixed[i] != null) {
        result[i] = fixed[i];
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < n && fixed[j + 1] == null) j++;
      const upper = i > 0 ? result[i - 1] : nowMs;
      const lower = j + 1 < n ? fixed[j + 1] : null;
      const count = j - i + 1;
      if (lower != null && upper > lower) {
        const step = (upper - lower) / (count + 1);
        for (let k = 0; k < count; k++) {
          result[i + k] = Math.round(upper - step * (k + 1));
        }
      } else {
        for (let k = 0; k < count; k++) {
          result[i + k] = upper - FALLBACK_STEP_MS * (k + 1);
        }
      }
      i = j + 1;
    }

    // Safety net: guarantee strict descent for flexible rows even if dense
    // interpolation rounded two neighbours equal. Anchors are left untouched.
    for (let k = 1; k < n; k++) {
      if (fixed[k] == null && result[k] >= result[k - 1]) {
        result[k] = result[k - 1] - 1;
      }
    }

    return result;
  }

  /**
   * Apply an exact date to one video and re-anchor its channel+tab so order is
   * preserved. Cheap-checks first and only does the full read+rewrite when the
   * exact date actually breaks order.
   * @param {{channelId: string, mediaType: string, youtubeId: string, exactIso: string}} args
   */
  async applyExactDateForGroup({ channelId, mediaType, youtubeId, exactIso }) {
    const newMs = Date.parse(exactIso);
    if (!Number.isFinite(newMs)) return;

    const target = await ChannelVideo.findOne({
      where: { youtube_id: youtubeId, channel_id: channelId, media_type: mediaType },
    });
    if (!target) return;

    const oldIso = target.publishedAt;
    const alreadyExact = target.published_at_source === PUBLISHED_AT_SOURCE.EXACT;
    if (oldIso === exactIso && alreadyExact) return;

    const breaks = await this._orderWouldBreak(channelId, mediaType, youtubeId, oldIso, exactIso);
    if (!breaks) {
      await target.update({ publishedAt: exactIso, published_at_source: PUBLISHED_AT_SOURCE.EXACT });
      return;
    }

    // Read in current order BEFORE changing anything so the target still sits in
    // its correct position, then apply the exact date in memory and re-anchor.
    const rows = await ChannelVideo.findAll({
      where: { channel_id: channelId, media_type: mediaType },
      order: [['publishedAt', 'DESC']],
      attributes: ['id', 'youtube_id', 'publishedAt', 'published_at_source'],
    });

    const input = rows.map((r) => {
      const isTarget = r.youtube_id === youtubeId;
      return {
        id: r.id,
        isTarget,
        oldIso: r.publishedAt,
        source: isTarget ? PUBLISHED_AT_SOURCE.EXACT : r.published_at_source,
        ms: isTarget ? newMs : (r.publishedAt ? Date.parse(r.publishedAt) : null),
      };
    });

    const newDates = this.computeReanchoredDates(input, Date.now());

    const changes = [];
    for (let i = 0; i < input.length; i++) {
      const row = input[i];
      if (row.isTarget) {
        changes.push({ id: row.id, fields: { publishedAt: exactIso, published_at_source: PUBLISHED_AT_SOURCE.EXACT } });
        continue;
      }
      const computedIso = new Date(newDates[i]).toISOString();
      if (computedIso !== row.oldIso) {
        // Source is preserved; only the date value shifts to hold ordering.
        changes.push({ id: row.id, fields: { publishedAt: computedIso } });
      }
    }

    if (changes.length === 0) return;

    await sequelize.transaction(async (t) => {
      for (const change of changes) {
        await ChannelVideo.update(change.fields, { where: { id: change.id }, transaction: t });
      }
    });

    logger.debug(
      { channelId, mediaType, youtubeId, rowsUpdated: changes.length },
      'Re-anchored channelvideos order after exact date'
    );
  }

  /**
   * Resolve every (channel, media_type) a video appears under and re-anchor each.
   * Convenience for callers that only know the youtube_id (e.g. modal metadata).
   * @param {string} youtubeId
   * @param {string} exactIso
   */
  async applyExactDateForVideo(youtubeId, exactIso) {
    const rows = await ChannelVideo.findAll({
      where: { youtube_id: youtubeId },
      attributes: ['channel_id', 'media_type'],
    });
    const groups = new Map();
    for (const r of rows) {
      groups.set(`${r.channel_id}::${r.media_type}`, {
        channelId: r.channel_id,
        mediaType: r.media_type,
      });
    }
    for (const g of groups.values()) {
      await this.applyExactDateForGroup({
        channelId: g.channelId,
        mediaType: g.mediaType,
        youtubeId,
        exactIso,
      });
    }
  }

  /**
   * Cheap pre-check: would moving this row to newIso violate descending order?
   * publishedAt is stored as same-format UTC ISO, so string comparison is
   * chronological. Conservatively returns true when the row is in a tie cluster,
   * since tie sub-order is otherwise ambiguous.
   * @private
   */
  async _orderWouldBreak(channelId, mediaType, youtubeId, oldIso, newIso) {
    if (!oldIso) return true;
    if (oldIso === newIso) return false;

    const base = {
      channel_id: channelId,
      media_type: mediaType,
      youtube_id: { [Op.ne]: youtubeId },
    };

    const tie = await ChannelVideo.count({ where: { ...base, publishedAt: oldIso } });
    if (tie > 0) return true;

    const between = newIso > oldIso
      ? { [Op.gt]: oldIso, [Op.lt]: newIso }
      : { [Op.lt]: oldIso, [Op.gt]: newIso };
    const count = await ChannelVideo.count({ where: { ...base, publishedAt: between } });
    return count > 0;
  }
}

module.exports = new ChannelVideoReanchorModule();
