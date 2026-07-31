'use strict';
const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');
module.exports = {
  async up(q, S) {
    for (const [column, roles] of [['allow_video_requests', "'request', 'delete', 'full_access'"], ['allow_channel_requests', "'request', 'delete', 'full_access'"], ['allow_delete_video_requests', "'delete', 'full_access'"]]) {
      await addColumnIfMissing(q, 'ApiKeys', column, { type: S.BOOLEAN, allowNull: true, defaultValue: null });
      await q.sequelize.query(`UPDATE ApiKeys SET ${column} = CASE WHEN role IN (${roles}) THEN true ELSE false END WHERE ${column} IS NULL`);
      await q.changeColumn('ApiKeys', column, { type: S.BOOLEAN, allowNull: false, defaultValue: false });
    }
  },
  async down(q) {
    const cols = await q.describeTable('ApiKeys');
    const checks = [['allow_video_requests', "role IN ('request', 'delete', 'full_access')"], ['allow_channel_requests', "role IN ('request', 'delete', 'full_access')"], ['allow_delete_video_requests', "role IN ('delete', 'full_access')"]].filter(([c]) => cols[c]);
    if (checks.length && cols.is_active && cols.revoked_at) await q.sequelize.query(`UPDATE ApiKeys SET is_active = false, revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE role <> 'legacy_download' AND (${checks.map(([c, r]) => `${c} <> CASE WHEN ${r} THEN true ELSE false END`).join(' OR ')})`);
    for (const c of ['allow_delete_video_requests', 'allow_channel_requests', 'allow_video_requests']) await removeColumnIfExists(q, 'ApiKeys', c);
  },
};
