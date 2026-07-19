const { Op } = require('sequelize');
const configModule = require('../configModule');
const { PLEX_OWNER_ACCOUNT_ID } = require('./adapters/plexAdapter');
const { Video, VideoWatchStatus, MediaServerUser } = require('../../models');

// Read-side companion to watchStatusSync: stateless queries over the rows the
// sync writes. Kept separate so the orchestrator stays write-only and the
// listing pages / video API don't depend on sync internals.
class WatchStatusQueries {
  // Watch-status rows for one video, shaped for the API. Returns [] for an
  // unknown video. Rows are deliberately retained even after a video stops
  // being observed on a server (deleted, moved, server disconnected): like
  // `removed` Videos rows, stale watch history is still a true observation,
  // and last_synced_at records its freshness.
  async getStatusesForVideo(youtubeId) {
    const video = await Video.findOne({ where: { youtubeId }, attributes: ['id'] });
    if (!video) return [];
    const rows = await VideoWatchStatus.findAll({
      where: { video_id: video.id },
      order: [['server_type', 'ASC'], ['server_user_id', 'ASC']],
    });
    if (rows.length === 0) return [];
    // The user directory is tiny; fetch it whole for name resolution.
    const userRows = await MediaServerUser.findAll({ raw: true });
    const nameByKey = new Map(
      userRows.map((u) => [`${u.server_type}:${u.server_user_id}`, u.server_user_name])
    );
    return rows.map((row) => ({
      server: row.server_type,
      serverUserId: row.server_user_id,
      userName: nameByKey.get(`${row.server_type}:${row.server_user_id}`) || null,
      played: !!row.played,
      playCount: row.play_count,
      percentWatched: row.percent_watched,
      lastWatchedAt: row.last_watched_at,
      lastSyncedAt: row.last_synced_at,
    }));
  }

  // Raw-SQL twin of getWatchedByMap's where clause, for queries that must
  // filter on watched state inside SQL (videosModule's paginated listing);
  // callers negate it with NOT for the "unwatched" side. Keep the rule in
  // sync with getWatchedByMap below.
  buildWatchedExistsSql() {
    const config = configModule.getConfig();
    const conditions = ['vws.video_id = Videos.id', 'vws.played = 1'];
    const replacements = {};
    if (config.watchStatusWatchedRule === 'primary') {
      conditions.push(
        '((vws.server_type = \'plex\' AND vws.server_user_id = :watchedPlexOwnerId)' +
        ' OR (vws.server_type = \'jellyfin\' AND vws.server_user_id = :watchedJellyfinUserId)' +
        ' OR (vws.server_type = \'emby\' AND vws.server_user_id = :watchedEmbyUserId))'
      );
      replacements.watchedPlexOwnerId = PLEX_OWNER_ACCOUNT_ID;
      replacements.watchedJellyfinUserId = config.jellyfinUserId || '';
      replacements.watchedEmbyUserId = config.embyUserId || '';
    }
    return {
      sql: `EXISTS (SELECT 1 FROM video_watch_status vws WHERE ${conditions.join(' AND ')})`,
      replacements,
    };
  }

  // Watched-on-which-servers summary for the listing pages: video id -> the
  // deduped server types with a played row, honoring watchStatusWatchedRule.
  // 'any' (the default) counts every synced user; 'primary' restores the
  // pre-multi-user behavior (Plex owner + the configured Jellyfin/Emby user).
  async getWatchedByMap(videoIds) {
    if (!videoIds || videoIds.length === 0) return new Map();
    const config = configModule.getConfig();
    const where = { video_id: videoIds, played: true };
    if (config.watchStatusWatchedRule === 'primary') {
      where[Op.or] = [
        { server_type: 'plex', server_user_id: PLEX_OWNER_ACCOUNT_ID },
        { server_type: 'jellyfin', server_user_id: config.jellyfinUserId || '' },
        { server_type: 'emby', server_user_id: config.embyUserId || '' },
      ];
    }
    const rows = await VideoWatchStatus.findAll({
      where,
      attributes: ['video_id', 'server_type'],
      raw: true,
    });
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.video_id)) map.set(row.video_id, new Set());
      map.get(row.video_id).add(row.server_type);
    }
    return new Map([...map].map(([id, set]) => [id, [...set]]));
  }
}

module.exports = new WatchStatusQueries();
