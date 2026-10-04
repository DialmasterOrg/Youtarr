const NEW_PATH = '/data/__TV/Chan/Season 2024/S2024E01 [id1].mp4';
const FROM_PATH = '/data/__Kids/Chan/Chan - Title - id1/Chan - Title [id1].mp4';

const hold = (overrides = {}) => ({
  id: 1, video_id: 7, server_type: 'jellyfin', server_user_id: 'u1', attempts: 0,
  snapshot: JSON.stringify({ played: true, positionMs: null, fromPath: FROM_PATH }),
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const matches = (byPath) => new Map(Object.entries(byPath));

describe('watchStatusPushBack', () => {
  let pushBack;
  let WatchStatusHold;
  let Video;
  let serverRegistry;
  let adapter;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
    jest.doMock('../../../models/watchstatushold', () => ({ findAll: jest.fn().mockResolvedValue([]) }));
    jest.doMock('../../../models/video', () => ({ findAll: jest.fn().mockResolvedValue([]) }));
    jest.doMock('../../configModule', () => ({ getConfig: jest.fn(() => ({})) }));
    jest.doMock('../serverRegistry', () => ({ getEnabledAdapters: jest.fn(() => []) }));
    jest.doMock('../watchStatusHolds', () => ({ HOLD_STATE: { PENDING: 'pending' } }));
    WatchStatusHold = require('../../../models/watchstatushold');
    Video = require('../../../models/video');
    serverRegistry = require('../serverRegistry');
    adapter = {
      serverType: 'jellyfin',
      // The new item: a full match at the new path, no match at the old one.
      resolveItemMatchesByPaths: jest.fn(async () => matches({ [NEW_PATH]: { id: 'item-1', score: 5 }, [FROM_PATH]: null })),
      getWatchState: jest.fn().mockResolvedValue(null),
      setWatchState: jest.fn().mockResolvedValue(undefined),
    };
    serverRegistry.getEnabledAdapters.mockReturnValue([adapter]);
    Video.findAll.mockResolvedValue([{ id: 7, filePath: NEW_PATH }]);
    pushBack = require('../watchStatusPushBack');
  });

  it('pushes the held state to the item at the video\'s current path', async () => {
    const pending = hold();
    WatchStatusHold.findAll.mockResolvedValue([pending]);

    const result = await pushBack.pushPendingHolds();

    expect(adapter.resolveItemMatchesByPaths).toHaveBeenCalledWith(expect.arrayContaining([NEW_PATH, FROM_PATH]));
    expect(adapter.setWatchState).toHaveBeenCalledWith('item-1', 'u1', expect.objectContaining({ played: true, positionMs: null }));
    expect(result).toEqual({ pushed: 1, notIndexed: 0, failed: 0 });
    expect(pending.update).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1, last_error: null, last_pushed_at: expect.any(Date) }));
  });

  it('records that the server has not indexed the moved file yet', async () => {
    const pending = hold();
    WatchStatusHold.findAll.mockResolvedValue([pending]);
    adapter.resolveItemMatchesByPaths.mockResolvedValue(new Map());

    const result = await pushBack.pushPendingHolds();

    expect(result.notIndexed).toBe(1);
    expect(adapter.setWatchState).not.toHaveBeenCalled();
    expect(pending.update.mock.calls[0][0].last_error).toMatch(/not indexed/);
  });

  it('does not push to a stale item that matches the old path better than the new one', async () => {
    const pending = hold({ snapshot: JSON.stringify({ played: true, positionMs: null, fromPath: '/data/__OldTV/Chan/Season 2024/S2024E01 [id1].mp4' }) });
    WatchStatusHold.findAll.mockResolvedValue([pending]);
    // Before the server rescans, the old item is the only candidate: it shares
    // Chan/Season 2024/<file> with the new path and everything with the old.
    adapter.resolveItemMatchesByPaths.mockResolvedValue(new Map([
      [NEW_PATH, { id: 'stale', score: 3 }],
      ['/data/__OldTV/Chan/Season 2024/S2024E01 [id1].mp4', { id: 'stale', score: 5 }],
    ]));

    const result = await pushBack.pushPendingHolds();

    expect(adapter.setWatchState).not.toHaveBeenCalled();
    expect(result.notIndexed).toBe(1);
  });

  it('pushes to the new item when the server still lists the old one as well', async () => {
    const oldPath = '/data/__OldTV/Chan/Season 2024/S2024E01 [id1].mp4';
    const pending = hold({ snapshot: JSON.stringify({ played: true, positionMs: null, fromPath: oldPath }) });
    WatchStatusHold.findAll.mockResolvedValue([pending]);
    adapter.resolveItemMatchesByPaths.mockResolvedValue(new Map([
      [NEW_PATH, { id: 'new', score: 5 }],
      [oldPath, { id: 'stale', score: 5 }],
    ]));

    const result = await pushBack.pushPendingHolds();

    expect(adapter.setWatchState).toHaveBeenCalledWith('new', 'u1', expect.objectContaining({ played: true }));
    expect(result.pushed).toBe(1);
  });

  it('pushes to the only matching item on an explicit retry', async () => {
    const pending = hold({ id: 4, snapshot: JSON.stringify({ played: true, positionMs: null, fromPath: '/data/__OldTV/Chan/Season 2024/S2024E01 [id1].mp4' }) });
    WatchStatusHold.findAll.mockResolvedValue([pending]);
    adapter.resolveItemMatchesByPaths.mockResolvedValue(new Map([
      [NEW_PATH, { id: 'only', score: 3 }],
      ['/data/__OldTV/Chan/Season 2024/S2024E01 [id1].mp4', { id: 'only', score: 3 }],
    ]));

    const result = await pushBack.pushPendingHolds({ holdIds: [4] });

    expect(adapter.setWatchState).toHaveBeenCalledWith('only', 'u1', expect.objectContaining({ played: true }));
    expect(result.pushed).toBe(1);
  });

  it('reads the item\'s state first and leaves a state at least as watched alone', async () => {
    const pending = hold();
    WatchStatusHold.findAll.mockResolvedValue([pending]);
    adapter.getWatchState.mockResolvedValue({ played: true, playCount: 1, positionMs: 0, lastWatchedAt: new Date() });

    const result = await pushBack.pushPendingHolds();

    expect(adapter.getWatchState).toHaveBeenCalledWith('item-1', 'u1');
    expect(adapter.setWatchState).not.toHaveBeenCalled();
    expect(result.pushed).toBe(1);
    expect(pending.update).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1, last_error: null }));
    expect(pending.update.mock.calls[0][0]).not.toHaveProperty('last_pushed_at');
  });

  it('does not overwrite a watch made after the snapshot', async () => {
    const pending = hold({ snapshot: JSON.stringify({ played: false, positionMs: 60000, lastWatchedAt: '2026-10-01T00:00:00.000Z' }) });
    WatchStatusHold.findAll.mockResolvedValue([pending]);
    adapter.getWatchState.mockResolvedValue({ played: false, playCount: 0, positionMs: 1000, lastWatchedAt: new Date('2026-10-03T00:00:00Z') });

    await pushBack.pushPendingHolds();

    expect(adapter.setWatchState).not.toHaveBeenCalled();
  });

  it('writes when the server shows less than the held state', async () => {
    const pending = hold({ snapshot: JSON.stringify({ played: false, positionMs: 60000, lastWatchedAt: null }) });
    WatchStatusHold.findAll.mockResolvedValue([pending]);
    adapter.getWatchState.mockResolvedValue({ played: false, playCount: 0, positionMs: 0, lastWatchedAt: null });

    await pushBack.pushPendingHolds();

    expect(adapter.setWatchState).toHaveBeenCalledWith('item-1', 'u1', expect.objectContaining({ positionMs: 60000 }));
  });

  it('records a failed write and carries on', async () => {
    const first = hold();
    const second = hold({ id: 2, server_user_id: 'u2' });
    WatchStatusHold.findAll.mockResolvedValue([first, second]);
    adapter.setWatchState.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    const result = await pushBack.pushPendingHolds();

    expect(result).toEqual({ pushed: 1, notIndexed: 0, failed: 1 });
    expect(first.update.mock.calls[0][0].last_error).toBe('boom');
  });

  it('records holds whose server is no longer configured', async () => {
    const pending = hold({ server_type: 'emby' });
    WatchStatusHold.findAll.mockResolvedValue([pending]);

    const result = await pushBack.pushPendingHolds();

    expect(result.failed).toBe(1);
    expect(pending.update.mock.calls[0][0].last_error).toMatch(/no longer configured/);
  });

  it('pushes holds never tried and holds whose last push did not take, not ones pushed successfully', async () => {
    const { Op } = require('sequelize');
    await pushBack.pushPendingHolds({ onlyDue: false });

    expect(WatchStatusHold.findAll.mock.calls[0][0].where[Op.or]).toEqual([
      { last_attempt_at: null },
      { last_error: { [Op.ne]: null } },
    ]);
  });

  it('waits an hour between pushes of a hold whose last push did not take', async () => {
    const { Op } = require('sequelize');
    const now = new Date('2026-10-03T12:00:00Z');
    await pushBack.pushPendingHolds({ now });

    expect(WatchStatusHold.findAll.mock.calls[0][0].where[Op.or]).toEqual([
      { last_attempt_at: null },
      { last_error: { [Op.ne]: null }, last_attempt_at: { [Op.lt]: new Date('2026-10-03T11:00:00Z') } },
    ]);
  });

  it('pushes only the named holds on an explicit retry, pushed before or not', async () => {
    const { Op } = require('sequelize');
    await pushBack.pushPendingHolds({ holdIds: [4] });

    expect(WatchStatusHold.findAll.mock.calls[0][0].where).toMatchObject({ id: [4], state: 'pending' });
    expect(WatchStatusHold.findAll.mock.calls[0][0].where[Op.or]).toBeUndefined();
  });

  it('schedules follow-up pushes after a reorganize', () => {
    const schedule = jest.fn(() => ({ unref: jest.fn() }));

    pushBack.scheduleFollowUps({ delaysMs: [10, 20], schedule });

    expect(schedule).toHaveBeenCalledTimes(2);
    expect(schedule.mock.calls.map((call) => call[1])).toEqual([10, 20]);
  });
});
