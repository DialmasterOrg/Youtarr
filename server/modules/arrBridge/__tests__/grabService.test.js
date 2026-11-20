/* eslint-env jest */
const { Op } = require('sequelize');
const { createGrabService, grabState } = require('../grabService');

const NOW = new Date('2025-06-10T12:00:00.000Z');
const GRAB_ID = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';
const TITLE = 'The.Office.US.S01E02.1080p.WEB-DL-NBC';
// Stands for the Video model, which listRecent only passes on.
const Video = { name: 'Video' };

const fields = (overrides = {}) => ({
  youtubeId: 'abcdefghijk',
  kind: 'tv',
  releaseTitle: TITLE,
  uploadDate: new Date('2024-03-01T12:00:00.000Z'),
  estimatedBytes: 1234,
  ...overrides,
});

function setup({ existing = null, historyRow = null, updated = 1, failedRows = [] } = {}) {
  const ArrBridgeGrab = {
    findOne: jest.fn(async ({ where }) => (where.id ? historyRow : existing)),
    findAll: jest.fn(async ({ where }) => (where.fail_message ? failedRows : [])),
    findAndCountAll: jest.fn(async () => ({ rows: [], count: 0 })),
    create: jest.fn(async (values) => values),
    update: jest.fn(async () => [updated]),
  };
  const deps = {
    models: { ArrBridgeGrab, Video },
    getSettings: () => ({ categories: [{ name: 'tv', subfolder: null }, { name: 'tv-4k', subfolder: null }] }),
    staging: { remove: jest.fn().mockResolvedValue(undefined) },
    wakeExecutor: jest.fn(),
    onHandedOff: jest.fn().mockResolvedValue(undefined),
    now: () => NOW,
    logger: { info: jest.fn(), warn: jest.fn() },
    newId: () => GRAB_ID,
  };
  return { service: createGrabService(deps), deps, ArrBridgeGrab };
}

describe('grabService', () => {
  describe('addGrab', () => {
    test('stores a pending grab and wakes the executor', async () => {
      const { service, deps, ArrBridgeGrab } = setup();

      const result = await service.addGrab({ fields: fields(), category: 'tv' });

      expect(result).toEqual({ id: GRAB_ID });
      expect(ArrBridgeGrab.create).toHaveBeenCalledWith({
        id: GRAB_ID,
        youtube_id: 'abcdefghijk',
        kind: 'tv',
        category: 'tv',
        release_title: TITLE,
        status: 'pending',
        estimated_bytes: 1234,
        created_at: NOW,
        updated_at: NOW,
      });
      expect(deps.wakeExecutor).toHaveBeenCalledTimes(1);
    });

    test('stores a title built before the YT marker existed unchanged', async () => {
      const { service, ArrBridgeGrab } = setup();
      const releaseTitle = 'Show.S01E05.1080p.WEB-DL-Chan';

      await service.addGrab({ fields: fields({ releaseTitle }), category: 'tv' });

      expect(ArrBridgeGrab.create).toHaveBeenCalledWith(expect.objectContaining({ release_title: releaseTitle }));
    });

    test('returns the grab already in progress for the same release instead of adding another', async () => {
      const { service, deps, ArrBridgeGrab } = setup({ existing: { id: 'first-grab', youtube_id: 'abcdefghijk' } });

      const result = await service.addGrab({ fields: fields(), category: 'tv' });

      expect(result).toEqual({ id: 'first-grab' });
      expect(ArrBridgeGrab.create).not.toHaveBeenCalled();
      expect(ArrBridgeGrab.findOne).toHaveBeenCalledWith({
        where: {
          category: 'tv',
          release_title: TITLE,
          status: { [Op.in]: ['pending', 'queued', 'completed'] },
        },
      });
      expect(deps.wakeExecutor).not.toHaveBeenCalled();
    });

    test('refuses another video whose release title is already on its way, instead of answering with the first', async () => {
      const { service, ArrBridgeGrab } = setup({ existing: { id: 'first-grab', youtube_id: 'zzzzzzzzzzz' } });

      const result = await service.addGrab({ fields: fields(), category: 'tv' });

      expect(result).toEqual({ error: 'A release with this name is already downloading in Youtarr' });
      expect(ArrBridgeGrab.create).not.toHaveBeenCalled();
    });

    test('the same release in another category is a separate grab', async () => {
      const { service, ArrBridgeGrab } = setup();
      await service.addGrab({ fields: fields(), category: 'tv-4k' });
      expect(ArrBridgeGrab.findOne.mock.calls[0][0].where.category).toBe('tv-4k');
      expect(ArrBridgeGrab.create).toHaveBeenCalledWith(expect.objectContaining({ category: 'tv-4k' }));
    });

    test('refuses a category Youtarr does not know', async () => {
      const { service, ArrBridgeGrab } = setup();

      const result = await service.addGrab({ fields: fields(), category: 'music' });

      expect(result).toEqual({ error: 'Category music is not configured in Youtarr' });
      expect(ArrBridgeGrab.create).not.toHaveBeenCalled();
    });

    test('does not echo a category that is not a plain name', async () => {
      const { service } = setup();
      const result = await service.addGrab({ fields: fields(), category: '<script>' });
      expect(result).toEqual({ error: 'Category is not configured in Youtarr' });
    });
  });

  describe('listQueue', () => {
    test('reads waiting grabs of one category, oldest first', async () => {
      const { service, ArrBridgeGrab } = setup();
      await service.listQueue('tv');
      expect(ArrBridgeGrab.findAll).toHaveBeenCalledWith({
        where: { status: { [Op.in]: ['pending', 'queued'] }, category: 'tv' },
        order: [['created_at', 'ASC'], ['id', 'ASC']],
        limit: 200,
      });
    });

    test('reads every category when none is given', async () => {
      const { service, ArrBridgeGrab } = setup();
      await service.listQueue(undefined);
      expect(ArrBridgeGrab.findAll.mock.calls[0][0].where).toEqual({ status: { [Op.in]: ['pending', 'queued'] } });
    });
  });

  describe('listHistory', () => {
    test('reads finished grabs newest first', async () => {
      const { service, ArrBridgeGrab } = setup();
      await service.listHistory('tv', 30);
      expect(ArrBridgeGrab.findAll).toHaveBeenCalledWith({
        where: { status: { [Op.in]: ['completed', 'failed'] }, category: 'tv' },
        order: [['completed_at', 'DESC'], ['id', 'DESC']],
        limit: 30,
      });
    });

    test.each([[5000, 200], [0, 60], [undefined, 60], ['abc', 60]])('limit %p becomes %p', async (limit, expected) => {
      const { service, ArrBridgeGrab } = setup();
      await service.listHistory('tv', limit);
      expect(ArrBridgeGrab.findAll.mock.calls[0][0].limit).toBe(expected);
    });
  });

  describe('removeFromQueue', () => {
    test('marks a waiting grab removed and leaves staging alone', async () => {
      const { service, deps, ArrBridgeGrab } = setup();

      await service.removeFromQueue(GRAB_ID);

      expect(ArrBridgeGrab.update).toHaveBeenCalledWith(
        { status: 'removed', removed_at: NOW, updated_at: NOW },
        { where: { id: GRAB_ID, status: { [Op.in]: ['pending', 'queued'] } } }
      );
      expect(deps.staging.remove).not.toHaveBeenCalled();
    });

    test('ignores an id that is not a grab id', async () => {
      const { service, ArrBridgeGrab } = setup();
      await service.removeFromQueue('SABnzbd_nzo_1234');
      expect(ArrBridgeGrab.update).not.toHaveBeenCalled();
    });
  });

  describe('removeFromHistory', () => {
    const row = { id: GRAB_ID, category: 'tv', release_title: TITLE, status: 'completed' };

    test('marks the grab removed and deletes its staged folder', async () => {
      const { service, deps, ArrBridgeGrab } = setup({ historyRow: row });

      await service.removeFromHistory(GRAB_ID);

      expect(ArrBridgeGrab.update).toHaveBeenCalledWith(
        { status: 'removed', removed_at: NOW, updated_at: NOW },
        { where: { id: GRAB_ID, status: { [Op.in]: ['completed', 'failed'] } } }
      );
      expect(deps.staging.remove).toHaveBeenCalledWith({ category: 'tv', releaseTitle: TITLE });
    });

    test('removing a failed grab leaves the staging folder alone, which may hold a later grab of the same release', async () => {
      const failed = { ...row, status: 'failed' };
      const { service, deps, ArrBridgeGrab } = setup({ historyRow: failed });

      await service.removeFromHistory(GRAB_ID);

      expect(ArrBridgeGrab.update).toHaveBeenCalledTimes(1);
      expect(deps.staging.remove).not.toHaveBeenCalled();
    });

    test('a staging failure is logged, not thrown', async () => {
      const { service, deps } = setup({ historyRow: row });
      deps.staging.remove.mockRejectedValue(new Error('EACCES'));

      await expect(service.removeFromHistory(GRAB_ID)).resolves.toBeUndefined();

      expect(deps.logger.warn).toHaveBeenCalledTimes(1);
    });

    test('hands the grab over and wakes the executor', async () => {
      const { service, deps } = setup({ historyRow: row });

      await service.removeFromHistory(GRAB_ID);

      expect(deps.onHandedOff).toHaveBeenCalledWith(row);
      expect(deps.wakeExecutor).toHaveBeenCalledTimes(1);
    });

    test('hands the grab over even when its staged folder could not be removed', async () => {
      const { service, deps } = setup({ historyRow: row });
      deps.staging.remove.mockRejectedValue(new Error('EACCES'));

      await service.removeFromHistory(GRAB_ID);

      expect(deps.onHandedOff).toHaveBeenCalledWith(row);
    });

    test('does not hand over a failed grab, which was never imported', async () => {
      const { service, deps } = setup({ historyRow: { ...row, status: 'failed' } });

      await service.removeFromHistory(GRAB_ID);

      expect(deps.onHandedOff).not.toHaveBeenCalled();
    });

    test('does not hand over a grab another request already removed', async () => {
      const { service, deps } = setup({ historyRow: row, updated: 0 });

      await service.removeFromHistory(GRAB_ID);

      expect(deps.onHandedOff).not.toHaveBeenCalled();
    });

    test('does nothing for an unknown grab', async () => {
      const { service, deps, ArrBridgeGrab } = setup({ historyRow: null });
      await service.removeFromHistory(GRAB_ID);
      expect(ArrBridgeGrab.update).not.toHaveBeenCalled();
      expect(deps.staging.remove).not.toHaveBeenCalled();
    });

    test('ignores an id that is not a grab id', async () => {
      const { service, ArrBridgeGrab } = setup({ historyRow: row });
      await service.removeFromHistory('../../etc');
      expect(ArrBridgeGrab.findOne).not.toHaveBeenCalled();
    });
  });

  describe('listRecent', () => {
    const VIDEO_TITLES = {
      model: Video, as: 'video', attributes: ['youTubeVideoName', 'youTubeChannelName'], required: false,
    };

    test('reads one page of grabs of every status, newest first, each with its video', async () => {
      const { service, ArrBridgeGrab } = setup();
      const rows = [{ id: 'b' }, { id: 'a' }];
      ArrBridgeGrab.findAndCountAll.mockResolvedValue({ rows, count: 42 });

      expect(await service.listRecent()).toEqual({ rows, total: 42, page: 1, pageSize: 10 });
      expect(ArrBridgeGrab.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        include: [VIDEO_TITLES],
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: 10,
        offset: 0,
      });
    });

    test('reads the page that was asked for', async () => {
      const { service, ArrBridgeGrab } = setup();

      const result = await service.listRecent({ page: '3', pageSize: '25' });

      expect(result).toMatchObject({ page: 3, pageSize: 25 });
      expect(ArrBridgeGrab.findAndCountAll.mock.calls[0][0]).toMatchObject({ limit: 25, offset: 50 });
    });

    test('every word of a search text must be in the release, the video id, the video title or the channel', async () => {
      const { service, ArrBridgeGrab } = setup();
      const matching = (pattern) => ({
        [Op.or]: [
          { release_title: { [Op.like]: pattern } },
          { youtube_id: { [Op.like]: pattern } },
          { '$video.youtube_video_name$': { [Op.like]: pattern } },
          { '$video.youtube_channel_name$': { [Op.like]: pattern } },
        ],
      });

      await service.listRecent({ q: 'office nbc' });

      expect(ArrBridgeGrab.findAndCountAll.mock.calls[0][0].where).toEqual({
        [Op.and]: [matching('%office%'), matching('%nbc%')],
      });
    });
  });

  describe('grabState', () => {
    const DONE = new Date('2025-06-10T11:00:00.000Z');

    test.each([
      ['waiting', { status: 'pending' }],
      ['downloading', { status: 'queued' }],
      ['ready', { status: 'completed', completed_at: DONE }],
      ['failed', { status: 'failed', completed_at: DONE, fail_message: 'Video unavailable' }],
      // Sonarr deletes a failed history item within a minute.
      ['failed', { status: 'removed', completed_at: DONE, fail_message: 'Video unavailable' }],
      ['handed-off', { status: 'removed', completed_at: DONE, fail_message: null }],
      ['cancelled', { status: 'removed', completed_at: null, fail_message: null }],
    ])('is %s for %p', (state, row) => {
      expect(grabState(row)).toBe(state);
    });
  });

  describe('recentlyFailedIds', () => {
    test('finds videos whose grab failed in the last 7 days, removed or not', async () => {
      const { service, ArrBridgeGrab } = setup({ failedRows: [{ youtube_id: 'abcdefghijk' }] });

      const result = await service.recentlyFailedIds(['abcdefghijk', 'zzzzzzzzzzz']);

      expect(result).toEqual(new Set(['abcdefghijk']));
      expect(ArrBridgeGrab.findAll).toHaveBeenCalledWith({
        attributes: ['youtube_id'],
        where: {
          youtube_id: { [Op.in]: ['abcdefghijk', 'zzzzzzzzzzz'] },
          fail_message: { [Op.ne]: null },
          completed_at: { [Op.gte]: new Date('2025-06-03T12:00:00.000Z') },
        },
        raw: true,
      });
    });

    test('skips the query for an empty list', async () => {
      const { service, ArrBridgeGrab } = setup();
      expect(await service.recentlyFailedIds([])).toEqual(new Set());
      expect(ArrBridgeGrab.findAll).not.toHaveBeenCalled();
    });
  });
});
