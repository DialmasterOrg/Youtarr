'use strict';
const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');
module.exports = {
  async up(q, S) {
    const cols = [
      ['role', { type: S.STRING(32), allowNull: false, defaultValue: 'legacy_download' }],
      ['auto_approve_video_requests', { type: S.BOOLEAN, allowNull: false, defaultValue: false }],
      ['auto_approve_channel_requests', { type: S.BOOLEAN, allowNull: false, defaultValue: false }],
      ['auto_approve_delete_requests', { type: S.BOOLEAN, allowNull: false, defaultValue: false }],
      ['max_rating_level', { type: S.INTEGER, allowNull: false, defaultValue: 4 }],
      ['allow_unrated', { type: S.BOOLEAN, allowNull: false, defaultValue: false }],
      ['allowed_media_types', { type: S.JSON, allowNull: true, defaultValue: null }],
      ['revoked_at', { type: S.DATE, allowNull: true, defaultValue: null }],
      ['allow_video_requests', { type: S.BOOLEAN, allowNull: true, defaultValue: null }],
      ['allow_channel_requests', { type: S.BOOLEAN, allowNull: true, defaultValue: null }],
      ['allow_delete_video_requests', { type: S.BOOLEAN, allowNull: true, defaultValue: null }],
      ['max_active_jobs', { type: S.INTEGER, allowNull: false, defaultValue: 5 }],
      ['hourly_write_limit', { type: S.INTEGER, allowNull: false, defaultValue: 30 }],
      ['daily_write_limit', { type: S.INTEGER, allowNull: false, defaultValue: 200 }],
    ];
    for (const [name, definition] of cols) await addColumnIfMissing(q, 'apikeys', name, definition);
    await q.sequelize.query("UPDATE apikeys SET role = 'legacy_download' WHERE role IS NULL OR role = ''");
    await q.sequelize.query("UPDATE apikeys SET allowed_media_types = JSON_ARRAY('video') WHERE allowed_media_types IS NULL");
    await q.changeColumn('apikeys', 'allowed_media_types', { type: S.JSON, allowNull: false });
    for (const [column, roles] of [['allow_video_requests', "'request', 'delete', 'admin'"], ['allow_channel_requests', "'request', 'delete', 'admin'"], ['allow_delete_video_requests', "'delete', 'admin'"]]) {
      await q.sequelize.query(`UPDATE apikeys SET ${column} = CASE WHEN role IN (${roles}) THEN true ELSE false END WHERE ${column} IS NULL`);
      await q.changeColumn('apikeys', column, { type: S.BOOLEAN, allowNull: false, defaultValue: false });
    }
  },
  async down(q) {
    const columns = await q.describeTable('apikeys');
    if (columns.role && columns.is_active) {
      const revokedAt = columns.revoked_at
        ? ', revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)'
        : '';
      await q.sequelize.query(`UPDATE apikeys SET is_active = false${revokedAt} WHERE role IS NOT NULL AND role <> 'legacy_download'`);
    }
    for (const name of ['daily_write_limit', 'hourly_write_limit', 'max_active_jobs', 'allow_delete_video_requests', 'allow_channel_requests', 'allow_video_requests', 'revoked_at', 'allowed_media_types', 'allow_unrated', 'max_rating_level', 'auto_approve_delete_requests', 'auto_approve_channel_requests', 'auto_approve_video_requests', 'role']) await removeColumnIfExists(q, 'apikeys', name);
  },
};
