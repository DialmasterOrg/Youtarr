jest.mock('../../../models', () => ({
  EpisodeConflict: { findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() },
}));
jest.mock('../../../models/channelvideo', () => ({ findAll: jest.fn(), update: jest.fn() }));

const CHANNEL_ID = 'UCDrqiuwNRbEahL1UEB0hkKQ';

function row(values) {
  const conflict = { youtube_id: 'dup', channel_id: CHANNEL_ID, kind: 'duplicate', archive_suppressed: false, archive_pending: null, ...values };
  conflict.update = jest.fn(async (patch) => Object.assign(conflict, patch));
  conflict.destroy = jest.fn();
  return conflict;
}

const duplicate = { youtubeId: 'dup', channelId: CHANNEL_ID, showId: 3, season: 1, episode: 20, duplicateOf: 'win' };

describe('episodeConflicts', () => {
  let conflicts;
  let models;
  let ChannelVideo;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    ChannelVideo = require('../../../models/channelvideo');
    conflicts = require('../episodeConflicts');
    models.EpisodeConflict.findByPk.mockResolvedValue(null);
    ChannelVideo.findAll.mockResolvedValue([]);
  });

  describe('recordDuplicate', () => {
    it('ignores a not-downloaded duplicate and asks for its archive line', async () => {
      await conflicts.recordDuplicate({ ...duplicate, downloaded: false });
      expect(ChannelVideo.update).toHaveBeenCalledWith(
        { ignored: true, ignored_at: expect.any(Date) },
        expect.objectContaining({ where: { channel_id: CHANNEL_ID, youtube_id: 'dup' } })
      );
      expect(models.EpisodeConflict.create).toHaveBeenCalledWith(expect.objectContaining({
        youtube_id: 'dup', kind: 'duplicate', show_id: 3, duplicate_of: 'win', archive_pending: 'add', youtarr_ignored: true,
        details: JSON.stringify({ season: 1, episode: 20 }),
      }), expect.anything());
    });

    it('leaves a video the user already ignored as the user\'s', async () => {
      ChannelVideo.findAll.mockResolvedValue([{ ignored: true }]);
      await conflicts.recordDuplicate({ ...duplicate, downloaded: false });
      expect(ChannelVideo.update).not.toHaveBeenCalled();
      expect(models.EpisodeConflict.create.mock.calls[0][0]).toMatchObject({ archive_pending: null, youtarr_ignored: false });
    });

    it('never ignores a downloaded duplicate', async () => {
      await conflicts.recordDuplicate({ ...duplicate, downloaded: true });
      expect(ChannelVideo.update).not.toHaveBeenCalled();
      expect(models.EpisodeConflict.create.mock.calls[0][0].archive_pending).toBeNull();
    });

    it('points an existing duplicate at its new holder', async () => {
      const existing = row({ archive_suppressed: true, duplicate_of: 'old' });
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.recordDuplicate({ ...duplicate, downloaded: false });
      expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({ kind: 'duplicate', duplicate_of: 'win' }), expect.anything());
    });

    it('suppresses a released duplicate again without removing its line first', async () => {
      const existing = row({ kind: 'released', archive_suppressed: true, archive_pending: 'remove' });
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.recordDuplicate({ ...duplicate, downloaded: false });
      expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({ kind: 'duplicate', archive_pending: null, youtarr_ignored: true }), expect.anything());
      expect(ChannelVideo.update).toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('takes back the ignore and asks to remove the line Youtarr wrote', async () => {
      const existing = row({ youtarr_ignored: true, archive_suppressed: true });
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.release('dup');
      expect(ChannelVideo.update).toHaveBeenCalledWith(
        { ignored: false, ignored_at: null },
        expect.objectContaining({ where: { channel_id: CHANNEL_ID, youtube_id: 'dup', ignored: true } })
      );
      expect(existing.update).toHaveBeenCalledWith({ kind: 'released', archive_pending: 'remove', youtarr_ignored: false }, expect.anything());
    });

    it('takes back Youtarr\'s ignore but keeps an archive line Youtarr did not write', async () => {
      const existing = row({ youtarr_ignored: true, archive_suppressed: false });
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.release('dup');
      expect(ChannelVideo.update).toHaveBeenCalledWith({ ignored: false, ignored_at: null }, expect.anything());
      expect(existing.destroy).toHaveBeenCalled();
    });

    it('never asks to remove an archive line Youtarr did not write', async () => {
      const existing = row({ youtarr_ignored: true, archive_suppressed: false });
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.release('dup');
      expect(existing.update).not.toHaveBeenCalled();
    });

    it('drops a conflict whose line was never written', async () => {
      const existing = row({ youtarr_ignored: true, archive_pending: 'add' });
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.release('dup');
      expect(ChannelVideo.update).toHaveBeenCalled();
      expect(existing.destroy).toHaveBeenCalled();
    });

    it('never touches the user\'s own ignore', async () => {
      const existing = row({});
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.release('dup');
      expect(ChannelVideo.update).not.toHaveBeenCalled();
      expect(existing.destroy).toHaveBeenCalled();
    });

    it('does nothing without a conflict', async () => {
      await expect(conflicts.release('none')).resolves.toBeUndefined();
    });
  });

  describe('noteArchiveLinesRemoved', () => {
    it('asks to write Youtarr\'s line again after an explicit download removed it', async () => {
      const existing = row({ archive_suppressed: true });
      models.EpisodeConflict.findAll.mockResolvedValue([existing]);
      await conflicts.noteArchiveLinesRemoved(['dup']);
      expect(existing.update).toHaveBeenCalledWith({ archive_suppressed: false, archive_pending: 'add' });
    });
  });

  describe('noteDownloaded', () => {
    it('hands the archive line to the download and takes back Youtarr\'s ignore', async () => {
      const existing = row({ youtarr_ignored: true, archive_pending: 'add' });
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.noteDownloaded('dup');
      expect(ChannelVideo.update).toHaveBeenCalledWith({ ignored: false, ignored_at: null }, expect.anything());
      expect(existing.update).toHaveBeenCalledWith({ youtarr_ignored: false, archive_suppressed: false, archive_pending: null });
    });

    it('leaves a conflict without Youtarr\'s suppression alone', async () => {
      const existing = row({});
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.noteDownloaded('dup');
      expect(existing.update).not.toHaveBeenCalled();
    });
  });

  describe('recordError', () => {
    it('records a classification error for a video without a conflict', async () => {
      await conflicts.recordError({ youtubeId: 'e', channelId: CHANNEL_ID, message: 'timed out' });
      expect(models.EpisodeConflict.create).toHaveBeenCalledWith(expect.objectContaining({
        youtube_id: 'e', kind: 'classification_error', show_id: null, details: JSON.stringify({ message: 'timed out' }),
      }), expect.anything());
    });

    it('leaves a duplicate conflict as it is', async () => {
      const existing = row({});
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.recordError({ youtubeId: 'dup', channelId: CHANNEL_ID, message: 'x' });
      expect(existing.update).not.toHaveBeenCalled();
    });

    it('takes over a released row, keeping its pending archive removal', async () => {
      const existing = row({ kind: 'released', archive_suppressed: true, archive_pending: 'remove', show_id: 3, duplicate_of: 'win' });
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.recordError({ youtubeId: 'dup', channelId: CHANNEL_ID, message: 'x' });
      expect(existing.update).toHaveBeenCalledWith(
        { channel_id: CHANNEL_ID, show_id: null, kind: 'classification_error', duplicate_of: null, details: JSON.stringify({ message: 'x' }) },
        expect.anything()
      );
      expect(existing).toMatchObject({ archive_suppressed: true, archive_pending: 'remove' });
    });
  });

  describe('clearError', () => {
    it('removes a classification error', async () => {
      const existing = row({ kind: 'classification_error' });
      models.EpisodeConflict.findByPk.mockResolvedValue(existing);
      await conflicts.clearError('dup');
      expect(existing.destroy).toHaveBeenCalled();
    });
  });

  describe('clearErrorsForChannel', () => {
    it('removes the channel\'s classification errors', async () => {
      models.EpisodeConflict.destroy = jest.fn();
      await conflicts.clearErrorsForChannel(CHANNEL_ID, { transaction: 't' });
      expect(models.EpisodeConflict.destroy).toHaveBeenCalledWith({ where: { channel_id: CHANNEL_ID, kind: 'classification_error' }, transaction: 't' });
    });
  });

  describe('duplicateIdsForChannel', () => {
    it('returns the ids of the channel\'s duplicates', async () => {
      models.EpisodeConflict.findAll.mockResolvedValue([row({ youtube_id: 'dup1' }), row({ youtube_id: 'dup2' })]);
      expect(await conflicts.duplicateIdsForChannel(CHANNEL_ID)).toEqual(new Set(['dup1', 'dup2']));
    });

    it('asks only for duplicates of that channel', async () => {
      models.EpisodeConflict.findAll.mockResolvedValue([]);
      await conflicts.duplicateIdsForChannel(CHANNEL_ID, { transaction: 't' });
      expect(models.EpisodeConflict.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { channel_id: CHANNEL_ID, kind: 'duplicate' }, transaction: 't',
      }));
    });
  });

  describe('listForChannel', () => {
    it('lists the channel\'s duplicates and errors with their details', async () => {
      models.EpisodeConflict.findAll.mockResolvedValue([row({ details: JSON.stringify({ season: 1, episode: 20 }), duplicate_of: 'win', show_id: 3 })]);
      expect(await conflicts.listForChannel(CHANNEL_ID)).toEqual([{
        youtubeId: 'dup', kind: 'duplicate', showId: 3, duplicateOf: 'win', season: 1, episode: 20, message: null, suppressed: false,
      }]);
    });

    it('reports a duplicate Youtarr ignored as suppressed, whoever wrote its archive line', async () => {
      models.EpisodeConflict.findAll.mockResolvedValue([row({ youtarr_ignored: true, archive_suppressed: false })]);
      expect((await conflicts.listForChannel(CHANNEL_ID))[0].suppressed).toBe(true);
    });
  });
});
