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
    ];
    for (const [name, definition] of cols) await addColumnIfMissing(q, 'ApiKeys', name, definition);
    await q.sequelize.query("UPDATE ApiKeys SET role = 'legacy_download' WHERE role IS NULL OR role = ''");
    await q.sequelize.query("UPDATE ApiKeys SET allowed_media_types = JSON_ARRAY('video') WHERE allowed_media_types IS NULL");
    await q.changeColumn('ApiKeys', 'allowed_media_types', { type: S.JSON, allowNull: false });
  },
  async down(q) {
    await q.sequelize.query("UPDATE ApiKeys SET is_active = false, revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE role IS NOT NULL AND role <> 'legacy_download'");
    for (const name of ['revoked_at', 'allowed_media_types', 'allow_unrated', 'max_rating_level', 'auto_approve_delete_requests', 'auto_approve_channel_requests', 'auto_approve_video_requests', 'role']) await removeColumnIfExists(q, 'ApiKeys', name);
  },
};
