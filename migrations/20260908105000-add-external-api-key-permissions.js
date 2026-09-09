'use strict';
const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');
module.exports = {
  async up(q, S) {
    for (const [column, roles] of [['allow_video_requests', "'request', 'delete', 'admin'"], ['allow_channel_requests', "'request', 'delete', 'admin'"], ['allow_delete_video_requests', "'delete', 'admin'"]]) {
      await addColumnIfMissing(q, 'apikeys', column, { type: S.BOOLEAN, allowNull: true, defaultValue: null });
      await q.sequelize.query(`UPDATE apikeys SET ${column} = CASE WHEN role IN (${roles}) THEN true ELSE false END WHERE ${column} IS NULL`);
      await q.changeColumn('apikeys', column, { type: S.BOOLEAN, allowNull: false, defaultValue: false });
    }
  },
  async down(q) {
    const cols = await q.describeTable('apikeys');
    const checks = [['allow_video_requests', "role IN ('request', 'delete', 'admin')"], ['allow_channel_requests', "role IN ('request', 'delete', 'admin')"], ['allow_delete_video_requests', "role IN ('delete', 'admin')"]].filter(([c]) => cols[c]);
    if (checks.length && cols.is_active && cols.revoked_at) await q.sequelize.query(`UPDATE apikeys SET is_active = false, revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE role <> 'legacy_download' AND (${checks.map(([c, r]) => `${c} <> CASE WHEN ${r} THEN true ELSE false END`).join(' OR ')})`);
    for (const c of ['allow_delete_video_requests', 'allow_channel_requests', 'allow_video_requests']) await removeColumnIfExists(q, 'apikeys', c);
  },
};
