const ChannelVideo = require('../models/channelvideo');
const archiveModule = require('./archiveModule');

// IDs yt-dlp would skip as already downloaded even though no Videos row
// exists (e.g. emptied from the trash with the archive entries kept). Ignored
// videos are left out: ignoring writes the archive entry on purpose, and an
// explicit download removes it again.
// Requires the one model it needs, not the models index. Nothing in production
// breaks either way; the constraint is downloadModule.test.js, which swaps model
// files for plain objects (jest.doMock) and loads playlistDownloadModule, which
// requires this. The index's association setup throws on those ("JobVideo.belongsTo
// called with something that's not a subclass of Sequelize.Model").
async function findArchiveOnlyIds(youtubeIds) {
  const archived = archiveModule.filterArchivedVideoIds(youtubeIds);
  if (archived.size === 0) return archived;
  const ignored = await ChannelVideo.findAll({
    where: { youtube_id: [...archived], ignored: true },
    attributes: ['youtube_id'],
  });
  for (const row of ignored) archived.delete(row.youtube_id);
  return archived;
}

module.exports = { findArchiveOnlyIds };
