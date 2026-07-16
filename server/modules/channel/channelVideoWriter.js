const ChannelVideo = require('../../models/channelvideo');
const channelVideoReanchor = require('../channelVideoReanchor');
const { PUBLISHED_AT_SOURCE } = require('../constants/publishedAtSource');

class ChannelVideoWriter {
  /**
   * Insert or update videos in the database, keeping the channel in YouTube
   * order even when some rows carry authoritative exact dates.
   *
   * YouTube intermittently serves channel-tab listings where every entry has
   * timestamp: null, but the entry order is still newest-first (verified
   * against captured degraded responses; only the timestamp field differs).
   * So rather than trust per-row dates, this runs in two phases (see the inline
   * Phase 1 / Phase 2 comments): the date value is deferred to a batch-wide
   * anchoring pass that assigns strictly-descending dates in fetch order.
   *
   * publishedAt precedence: 'estimated' < 'approximate'/NULL < 'exact'.
   * 'exact' comes from a download's .info.json and is never overwritten here.
   * @param {Array<Object>} videos - Video objects in yt-dlp response order
   *   (newest first)
   * @param {string} channelId - Channel ID these videos belong to
   * @returns {Promise<void>}
   */
  async insertVideosIntoDb(videos, channelId, mediaType = 'video') {
    const nowMs = Date.now();
    const provisionalIso = new Date(nowMs).toISOString();

    // Phase 1: ensure every row exists and upsert its non-date fields, and
    // classify each row's ordering source + candidate date. The date VALUE is
    // deliberately deferred to phase 2, where the shared anchoring algorithm
    // assigns strictly-descending dates across the whole batch. This keeps
    // ordering correct around scattered exact dates, since a fetched/existing
    // approximate date newer than a nearby exact date must be clamped below it.
    const entries = [];
    for (const video of videos) {
      const [videoRecord, created] = await ChannelVideo.findOrCreate({
        where: {
          youtube_id: video.youtube_id,
          channel_id: channelId
        },
        defaults: {
          ...video,
          publishedAt: video.publishedAt || provisionalIso,
          published_at_source: video.publishedAt ? PUBLISHED_AT_SOURCE.APPROXIMATE : PUBLISHED_AT_SOURCE.ESTIMATED,
          channel_id: channelId,
          media_type: mediaType,
        },
      });

      if (!created) {
        const updates = {
          title: video.title,
          thumbnail: video.thumbnail,
          duration: video.duration,
          media_type: mediaType,
        };

        // Only overwrite availability/live_status when yt-dlp returned a real value.
        // yt-dlp's flat-playlist mode currently omits these for lockupViewModel
        // entries, so an empty refresh must not wipe known-good values that other
        // code paths (modal open, download error, URL validation) populated.
        if (video.availability) updates.availability = video.availability;
        if (video.live_status) updates.live_status = video.live_status;
        if (video.content_rating != null) updates.content_rating = video.content_rating;
        if (video.age_limit != null) updates.age_limit = video.age_limit;
        if (video.normalized_rating != null) updates.normalized_rating = video.normalized_rating;
        // publishedAt / published_at_source intentionally deferred to phase 2.
        await videoRecord.update(updates);
      }

      // Classify for ordering. Exact dates (.info.json) are immovable anchors;
      // a freshly fetched or existing real date is a soft anchor; everything
      // else is an estimated placeholder.
      const isExact = videoRecord.published_at_source === PUBLISHED_AT_SOURCE.EXACT;
      let orderingSource;
      let candidateMs;
      if (isExact) {
        orderingSource = PUBLISHED_AT_SOURCE.EXACT;
        candidateMs = videoRecord.publishedAt ? Date.parse(videoRecord.publishedAt) : null;
      } else if (video.publishedAt) {
        orderingSource = PUBLISHED_AT_SOURCE.APPROXIMATE;
        candidateMs = Date.parse(video.publishedAt);
      } else if (videoRecord.publishedAt && videoRecord.published_at_source !== PUBLISHED_AT_SOURCE.ESTIMATED) {
        // Existing real (approximate / legacy) date, no fresh date this fetch.
        orderingSource = PUBLISHED_AT_SOURCE.APPROXIMATE;
        candidateMs = Date.parse(videoRecord.publishedAt);
      } else {
        orderingSource = PUBLISHED_AT_SOURCE.ESTIMATED;
        candidateMs = null;
      }

      entries.push({
        id: videoRecord.id,
        oldIso: videoRecord.publishedAt,
        oldSource: videoRecord.published_at_source,
        orderingSource,
        candidateMs: Number.isFinite(candidateMs) ? candidateMs : null,
        hasFetchedDate: Boolean(video.publishedAt),
      });
    }

    if (entries.length === 0) return;

    // Phase 2: compute a strictly-descending date for every row in fetch order
    // (newest first) and persist only the rows whose date or source changed.
    const orderedDates = channelVideoReanchor.computeReanchoredDates(
      entries.map((e) => ({ ms: e.candidateMs, source: e.orderingSource })),
      nowMs
    );

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.orderingSource === PUBLISHED_AT_SOURCE.EXACT) continue; // never rewrite exact dates

      const newIso = new Date(orderedDates[i]).toISOString();
      // A freshly fetched date is 'approximate'; otherwise preserve the existing
      // label (estimated stays estimated, legacy NULL stays NULL).
      const newSource = entry.hasFetchedDate ? PUBLISHED_AT_SOURCE.APPROXIMATE : entry.oldSource;

      if (newIso !== entry.oldIso || newSource !== entry.oldSource) {
        const fields = { publishedAt: newIso };
        if (newSource !== entry.oldSource) fields.published_at_source = newSource;
        await ChannelVideo.update(fields, { where: { id: entry.id } });
      }
    }
  }
}

module.exports = new ChannelVideoWriter();
