jest.mock('../../../models', () => ({
  EpisodeConflict: { findAll: jest.fn() },
}));
jest.mock('../../archiveModule', () => ({
  addVideoToArchive: jest.fn().mockResolvedValue(true),
  removeVideoFromArchive: jest.fn().mockResolvedValue(true),
  isVideoInArchive: jest.fn(),
}));
jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

function conflict(youtubeId, values) {
  const row = { youtube_id: youtubeId, kind: 'duplicate', archive_suppressed: false, archive_pending: null, ...values };
  row.update = jest.fn(async (patch) => Object.assign(row, patch));
  row.destroy = jest.fn();
  return row;
}

describe('archiveSuppressor', () => {
  let suppressor;
  let models;
  let archiveModule;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    archiveModule = require('../../archiveModule');
    suppressor = require('../archiveSuppressor');
  });

  it('writes nothing until it knows whether a download is running', async () => {
    models.EpisodeConflict.findAll.mockResolvedValue([conflict('a', { archive_pending: 'add' })]);
    await suppressor.flush();
    expect(archiveModule.addVideoToArchive).not.toHaveBeenCalled();
  });

  it('writes nothing while a download job runs', async () => {
    suppressor.initialize({ isDownloadRunning: () => true });
    models.EpisodeConflict.findAll.mockResolvedValue([conflict('a', { archive_pending: 'add' })]);
    await suppressor.flush();
    expect(archiveModule.addVideoToArchive).not.toHaveBeenCalled();
  });

  describe('when no download runs', () => {
    beforeEach(() => {
      suppressor.initialize({ isDownloadRunning: () => false });
      archiveModule.isVideoInArchive.mockImplementation(async (id) => archiveModule.addVideoToArchive.mock.calls.some(([added]) => added === id));
    });

    it('adds a pending line and records that Youtarr wrote it', async () => {
      const row = conflict('a', { archive_pending: 'add' });
      models.EpisodeConflict.findAll.mockResolvedValue([row]);
      await suppressor.flush();
      expect(archiveModule.addVideoToArchive).toHaveBeenCalledWith('a');
      expect(row).toMatchObject({ archive_pending: null, archive_suppressed: true });
    });

    it('records that the line is Youtarr\'s before appending it', async () => {
      const row = conflict('a', { archive_pending: 'add' });
      models.EpisodeConflict.findAll.mockResolvedValue([row]);
      await suppressor.flush();
      const owned = row.update.mock.calls.findIndex(([patch]) => patch.archive_suppressed === true);
      expect(owned).toBeGreaterThanOrEqual(0);
      expect(row.update.mock.invocationCallOrder[owned]).toBeLessThan(archiveModule.addVideoToArchive.mock.invocationCallOrder[0]);
    });

    it('keeps ownership of a line it appended when the retry finds it there', async () => {
      // The append went through but the row was not updated (a restart in between).
      archiveModule.isVideoInArchive.mockResolvedValue(true);
      const row = conflict('a', { archive_pending: 'add', archive_suppressed: true });
      models.EpisodeConflict.findAll.mockResolvedValue([row]);
      await suppressor.flush();
      expect(archiveModule.addVideoToArchive).not.toHaveBeenCalled();
      expect(row).toMatchObject({ archive_pending: null, archive_suppressed: true });
    });

    it('leaves a line that was already in the archive as not Youtarr\'s', async () => {
      archiveModule.isVideoInArchive.mockResolvedValue(true);
      const row = conflict('a', { archive_pending: 'add' });
      models.EpisodeConflict.findAll.mockResolvedValue([row]);
      await suppressor.flush();
      expect(archiveModule.addVideoToArchive).not.toHaveBeenCalled();
      expect(row.update).toHaveBeenCalledWith({ archive_pending: null, archive_suppressed: false });
    });

    it('removes a pending line and forgets that Youtarr wrote it', async () => {
      const row = conflict('b', { archive_pending: 'remove', archive_suppressed: true });
      models.EpisodeConflict.findAll.mockResolvedValue([row]);
      await suppressor.flush();
      expect(archiveModule.removeVideoFromArchive).toHaveBeenCalledWith('b');
      expect(row.update).toHaveBeenCalledWith({ archive_pending: null, archive_suppressed: false });
    });

    it('keeps the request when the line did not reach the archive', async () => {
      archiveModule.addVideoToArchive.mockResolvedValueOnce(false);
      archiveModule.isVideoInArchive.mockResolvedValue(false);
      const row = conflict('a', { archive_pending: 'add' });
      models.EpisodeConflict.findAll.mockResolvedValue([row]);
      await suppressor.flush();
      expect(row.archive_pending).toBe('add');
    });

    it('deletes a released conflict once its line is removed', async () => {
      const row = conflict('c', { kind: 'released', archive_pending: 'remove', archive_suppressed: true });
      models.EpisodeConflict.findAll.mockResolvedValue([row]);
      await suppressor.flush();
      expect(row.destroy).toHaveBeenCalled();
    });

    it('keeps the request when the archive write fails', async () => {
      archiveModule.addVideoToArchive.mockRejectedValueOnce(new Error('EACCES'));
      const row = conflict('a', { archive_pending: 'add' });
      models.EpisodeConflict.findAll.mockResolvedValue([row]);
      await suppressor.flush();
      expect(row.archive_pending).toBe('add');
    });

    it('runs one flush at a time', async () => {
      let release;
      models.EpisodeConflict.findAll.mockReturnValue(new Promise((resolve) => { release = resolve; }));
      const first = suppressor.flush();
      const second = suppressor.flush();
      release([]);
      await Promise.all([first, second]);
      expect(models.EpisodeConflict.findAll).toHaveBeenCalledTimes(1);
    });
  });
});
