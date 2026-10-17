const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');

async function attachRequestStatuses(key, rows) {
  if (rows.length === 0) return;
  // Limit the history lookup to the displayed page. A correlated ORDER BY /
  // LIMIT subquery can scan a key's entire history for every catalog candidate
  // on MySQL, even when a matching composite index exists.
  const requests = await sequelize.query(
    `SELECT youtube_id, status FROM (
       SELECT youtube_id, status,
              ROW_NUMBER() OVER (
                PARTITION BY youtube_id ORDER BY created_at DESC, id DESC
              ) AS request_rank
         FROM external_requests
        WHERE api_key_id = :keyId AND request_type = 'video'
          AND youtube_id IN (:youtubeIds)
     ) ranked WHERE request_rank = 1`,
    {
      replacements: { keyId: key.id, youtubeIds: [...new Set(rows.map(row => row.youtube_id))] },
      type: QueryTypes.SELECT,
    }
  );
  const statuses = new Map(requests.map(request => [request.youtube_id, request.status]));
  for (const row of rows) row.request_status = statuses.get(row.youtube_id) || null;
}

module.exports = { attachRequestStatuses };
