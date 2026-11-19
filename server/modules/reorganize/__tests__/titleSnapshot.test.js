jest.mock('../../../db', () => ({ sequelize: { transaction: jest.fn(async (fn) => fn('t')) } }));
jest.mock('../../../models', () => ({
  VideoClassification: { findAll: jest.fn(), update: jest.fn(), destroy: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  EpisodeConflict: { findAll: jest.fn(), update: jest.fn() },
  Video: { findAll: jest.fn() },
  TvShowPattern: { findAll: jest.fn() },
}));
jest.mock('../../tvShows/titleShowStore', () => ({
  listTitleShows: jest.fn(), saveDefinitions: jest.fn(), titleShowIds: jest.fn(), deleteShows: jest.fn(),
}));
jest.mock('../../tvShows/episodeConflicts', () => ({ release: jest.fn(), recordDuplicate: jest.fn(), recordError: jest.fn() }));
jest.mock('../../tvShows/archiveSuppressor', () => ({ flush: jest.fn() }));

const CHANNEL_ID = 'UC1';

const show = (id, extra = {}) => ({
  id, key: `title:${id}`, name: `Show ${id}`, folderName: `Show ${id}`, libraryFolder: 'TV', position: 0, retired: false,
  excludeTerms: [], seasonNames: {}, patterns: [{ id: id * 10, key: `title:${id}#0`, position: 0, text: 't' }], ...extra,
});

const row = (youtubeId, extra = {}) => ({
  youtube_id: youtubeId, channel_id: CHANNEL_ID, show_id: 3, status: 'assigned', season: 1, episode: 20, source: 'title',
  timestamp_source: null, pattern_id: 30, episode_title: 'x', file_stem: 's', title_opt_out: false, ...extra,
});

describe('reorganize titleSnapshot', () => {
  let titleSnapshot;
  let models;
  let store;
  let conflicts;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    store = require('../../tvShows/titleShowStore');
    conflicts = require('../../tvShows/episodeConflicts');
    titleSnapshot = require('../titleSnapshot');
    models.Video.findAll.mockResolvedValue([]);
  });

  describe('takeTitleSnapshot', () => {
    it('keeps the channel\'s shows, episode rows and conflicts', async () => {
      store.listTitleShows.mockResolvedValue([show(3)]);
      models.VideoClassification.findAll.mockResolvedValue([{ ...row('aaaaaaaaaaa'), created_at: 'c', updated_at: 'u' }]);
      models.EpisodeConflict.findAll.mockResolvedValue([{ youtube_id: 'dup', kind: 'duplicate', show_id: 3, duplicate_of: 'aaaaaaaaaaa', details: '{}' }]);
      const snapshot = await titleSnapshot.takeTitleSnapshot(CHANNEL_ID);
      expect(snapshot).toEqual({
        shows: [show(3)],
        rows: [row('aaaaaaaaaaa')],
        conflicts: [{ youtubeId: 'dup', kind: 'duplicate', showId: 3, duplicateOf: 'aaaaaaaaaaa', details: '{}' }],
      });
      expect(store.listTitleShows).toHaveBeenCalledWith(CHANNEL_ID, { includeRetired: true });
    });
  });

  describe('restoreTitleSnapshot', () => {
    const channel = { channel_id: CHANNEL_ID };

    beforeEach(() => {
      store.saveDefinitions.mockResolvedValue({ showIds: new Map([['title:3', 3]]), patternIds: new Map([['title:3#0', 31]]) });
      models.VideoClassification.findAll.mockResolvedValue([{ youtube_id: 'aaaaaaaaaaa' }, { youtube_id: 'new00000000' }]);
      models.EpisodeConflict.findAll.mockResolvedValue([]);
      store.titleShowIds.mockResolvedValue([3]);
      models.TvShowPattern.findAll.mockResolvedValue([]);
    });

    it('saves the shows that were active', async () => {
      await titleSnapshot.restoreTitleSnapshot(channel, { shows: [show(3), show(5, { retired: true })], rows: [], conflicts: [] });
      expect(store.saveDefinitions).toHaveBeenCalledWith({ channelId: CHANNEL_ID, drafts: [show(3)], transaction: 't' });
    });

    it('frees every number first, then puts the stored rows back with their patterns\' new ids', async () => {
      const stored = { update: jest.fn() };
      models.VideoClassification.findByPk.mockResolvedValue(stored);
      await titleSnapshot.restoreTitleSnapshot(channel, { shows: [show(3)], rows: [row('aaaaaaaaaaa')], conflicts: [] });
      expect(models.VideoClassification.update).toHaveBeenCalledWith(
        { season: null, episode: null }, { where: { channel_id: CHANNEL_ID }, transaction: 't' }
      );
      expect(stored.update).toHaveBeenCalledWith(expect.objectContaining({ season: 1, episode: 20, pattern_id: 31 }), { transaction: 't' });
    });

    it('keeps the pattern of a row whose show stays removed', async () => {
      const stored = { update: jest.fn() };
      models.VideoClassification.findByPk.mockResolvedValue(stored);
      models.TvShowPattern.findAll.mockResolvedValue([{ id: 50, show_id: 5, position: 0 }]);
      await titleSnapshot.restoreTitleSnapshot(channel, {
        shows: [show(3), show(5, { retired: true })],
        rows: [row('bbbbbbbbbbb', { show_id: 5, source: 'order', pattern_id: 50 })],
        conflicts: [],
      });
      expect(stored.update).toHaveBeenCalledWith(expect.objectContaining({ show_id: 5, pattern_id: 50 }), { transaction: 't' });
    });

    it('deletes rows the change created', async () => {
      models.VideoClassification.findByPk.mockResolvedValue({ update: jest.fn() });
      await titleSnapshot.restoreTitleSnapshot(channel, { shows: [show(3)], rows: [row('aaaaaaaaaaa')], conflicts: [] });
      expect(models.VideoClassification.destroy).toHaveBeenCalledWith({ where: { youtube_id: ['new00000000'] }, transaction: 't' });
    });

    it('releases conflicts the change recorded', async () => {
      models.EpisodeConflict.findAll.mockResolvedValue([{ youtube_id: 'dup', kind: 'duplicate' }]);
      await titleSnapshot.restoreTitleSnapshot(channel, { shows: [], rows: [], conflicts: [] });
      expect(conflicts.release).toHaveBeenCalledWith('dup', { transaction: 't' });
    });

    it('records again a duplicate the change released', async () => {
      models.Video.findAll.mockResolvedValue([{ youtubeId: 'dup' }]);
      await titleSnapshot.restoreTitleSnapshot(channel, {
        shows: [show(3)], rows: [],
        conflicts: [{ youtubeId: 'dup', kind: 'duplicate', showId: 3, duplicateOf: 'win', details: JSON.stringify({ season: 1, episode: 20 }) }],
      });
      expect(conflicts.recordDuplicate).toHaveBeenCalledWith({
        youtubeId: 'dup', channelId: CHANNEL_ID, showId: 3, season: 1, episode: 20, duplicateOf: 'win', downloaded: true, transaction: 't',
      });
    });

    it('deletes the shows the change added, so a retry can create them again', async () => {
      store.titleShowIds.mockResolvedValue([3, 5, 7]);
      await titleSnapshot.restoreTitleSnapshot(channel, { shows: [show(3), show(5, { retired: true })], rows: [], conflicts: [] });
      expect(store.deleteShows).toHaveBeenCalledWith([7], { transaction: 't' });
    });

    it('detaches conflicts from the shows it deletes first', async () => {
      store.titleShowIds.mockResolvedValue([3, 7]);
      await titleSnapshot.restoreTitleSnapshot(channel, { shows: [show(3)], rows: [], conflicts: [] });
      expect(models.EpisodeConflict.update).toHaveBeenCalledWith({ show_id: null }, { where: { show_id: [7] }, transaction: 't' });
      expect(models.EpisodeConflict.update.mock.invocationCallOrder[0]).toBeLessThan(store.deleteShows.mock.invocationCallOrder[0]);
    });

    it('deletes no show when the change added none', async () => {
      await titleSnapshot.restoreTitleSnapshot(channel, { shows: [show(3)], rows: [], conflicts: [] });
      expect(store.deleteShows).not.toHaveBeenCalled();
    });

    it('puts back a conflict the change pointed at another episode or holder', async () => {
      models.EpisodeConflict.findAll.mockResolvedValue([
        { youtube_id: 'dup', kind: 'duplicate', show_id: 3, duplicate_of: 'other', details: JSON.stringify({ season: 1, episode: 21 }) },
      ]);
      await titleSnapshot.restoreTitleSnapshot(channel, {
        shows: [show(3)], rows: [],
        conflicts: [{ youtubeId: 'dup', kind: 'duplicate', showId: 3, duplicateOf: 'win', details: JSON.stringify({ season: 1, episode: 20 }) }],
      });
      expect(conflicts.recordDuplicate).toHaveBeenCalledWith(expect.objectContaining({ youtubeId: 'dup', episode: 20, duplicateOf: 'win' }));
    });

    it('releases a conflict whose kind the change changed before recording the old one', async () => {
      models.EpisodeConflict.findAll.mockResolvedValue([
        { youtube_id: 'err', kind: 'duplicate', show_id: 3, duplicate_of: 'win', details: JSON.stringify({ season: 1, episode: 20 }) },
      ]);
      await titleSnapshot.restoreTitleSnapshot(channel, {
        shows: [show(3)], rows: [],
        conflicts: [{ youtubeId: 'err', kind: 'classification_error', showId: null, duplicateOf: null, details: JSON.stringify({ message: 'boom' }) }],
      });
      expect(conflicts.release).toHaveBeenCalledWith('err', { transaction: 't' });
      expect(conflicts.recordError).toHaveBeenCalledWith({ youtubeId: 'err', channelId: CHANNEL_ID, message: 'boom', transaction: 't' });
      expect(conflicts.release.mock.invocationCallOrder[0]).toBeLessThan(conflicts.recordError.mock.invocationCallOrder[0]);
    });

    it('does not release a conflict the change only pointed elsewhere', async () => {
      models.EpisodeConflict.findAll.mockResolvedValue([
        { youtube_id: 'dup', kind: 'duplicate', show_id: 3, duplicate_of: 'other', details: JSON.stringify({ season: 1, episode: 21 }) },
      ]);
      await titleSnapshot.restoreTitleSnapshot(channel, {
        shows: [show(3)], rows: [],
        conflicts: [{ youtubeId: 'dup', kind: 'duplicate', showId: 3, duplicateOf: 'win', details: JSON.stringify({ season: 1, episode: 20 }) }],
      });
      expect(conflicts.release).not.toHaveBeenCalled();
    });

    it('leaves a conflict the change did not touch as it is', async () => {
      const details = JSON.stringify({ season: 1, episode: 20 });
      models.EpisodeConflict.findAll.mockResolvedValue([{ youtube_id: 'dup', kind: 'duplicate', show_id: 3, duplicate_of: 'win', details }]);
      await titleSnapshot.restoreTitleSnapshot(channel, {
        shows: [show(3)], rows: [], conflicts: [{ youtubeId: 'dup', kind: 'duplicate', showId: 3, duplicateOf: 'win', details }],
      });
      expect(conflicts.recordDuplicate).not.toHaveBeenCalled();
    });

    it('applies the archive changes after the restore', async () => {
      await titleSnapshot.restoreTitleSnapshot(channel, { shows: [], rows: [], conflicts: [] });
      expect(require('../../tvShows/archiveSuppressor').flush).toHaveBeenCalled();
    });
  });
});
