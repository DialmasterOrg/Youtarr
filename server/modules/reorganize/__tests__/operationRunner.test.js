jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ getConfig: jest.fn(() => ({})) }));
jest.mock('../../messageEmitter', () => ({ emitMessage: jest.fn() }));
jest.mock('../../mediaServers/watchStatusHolds', () => ({
  createHolds: jest.fn().mockResolvedValue(1),
  releaseUnmovedHolds: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../tvShows/libraryLayouts', () => ({ getLayoutResolver: jest.fn().mockResolvedValue(() => 'videos') }));
jest.mock('../operationStore', () => ({
  createOperation: jest.fn(),
  settingsOf: jest.fn((operation) => JSON.parse(operation.settings_change)),
  markSettingsApplied: jest.fn(),
  itemsWithStatus: jest.fn(),
  markItem: jest.fn(),
  refreshCounts: jest.fn(),
  finishOperation: jest.fn(),
  reopenOperation: jest.fn(),
  findUnfinished: jest.fn(),
  findOperation: jest.fn(),
  resetFailedItems: jest.fn(),
  hasNewerOperationFor: jest.fn().mockResolvedValue(false),
}));
jest.mock('../planner', () => ({ buildPlan: jest.fn(), summarizePlan: jest.fn(), applyRefusal: jest.fn(() => null) }));
jest.mock('../settingsApplier', () => ({ applySettings: jest.fn(), rollbackSettings: jest.fn() }));
jest.mock('../itemExecutor', () => ({ executeItem: jest.fn() }));
jest.mock('../followUp', () => ({ finishFiles: jest.fn(), finishServers: jest.fn().mockResolvedValue(undefined) }));

const CHANGE = { type: 'channel', channelId: 'UC1', subFolder: 'TV' };

const flush = async (until) => {
  for (let i = 0; i < 50; i++) {
    if (until()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
};

describe('reorganize operationRunner', () => {
  let runner;
  let lock;
  let store;
  let planner;
  let applier;
  let executor;
  let followUp;
  let deps;
  let operation;

  const item = (id) => ({ id, youtube_id: `vid${id}`, video_id: id, channel_id: 'UC1', files: '{}', classification: null });
  const plan = (items = [{ videoId: 1, youtubeId: 'vid1', channelId: 'UC1' }]) => ({
    revision: 'rev',
    items,
    shows: [{ ownerChannelId: 'UC1', showId: null }],
    context: { type: 'channel', label: 'Chan', stored: CHANGE, channel: { channel_id: 'UC1' }, layoutBefore: () => 'videos' },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    lock = require('../reorganizeLock');
    store = require('../operationStore');
    planner = require('../planner');
    applier = require('../settingsApplier');
    executor = require('../itemExecutor');
    followUp = require('../followUp');
    operation = {
      id: 3, status: 'running', total_items: 2, done_items: 0, failed_items: 0, settings_applied: false,
      settings_change: JSON.stringify({ change: CHANGE, label: 'Chan', shows: [{ ownerChannelId: 'UC1', showId: null }] }),
      update: jest.fn(async (values) => Object.assign(operation, values)),
    };
    store.createOperation.mockResolvedValue(operation);
    store.itemsWithStatus.mockResolvedValue([item(1), item(2)]);
    store.refreshCounts.mockResolvedValue({ done: 2, failed: 0, pending: 0 });
    applier.applySettings.mockImplementation(async ({ shows }) => shows.map((show) => ({ ...show, showId: 9 })));
    planner.buildPlan.mockResolvedValue(plan());
    deps = {
      jobModule: { getInProgressJobId: jest.fn(() => null), isArchiveRepairRunning: jest.fn(() => false) },
      scheduledTaskManager: { isTaskRunningById: jest.fn(() => false) },
      videosModule: { isBackfillRunning: jest.fn(() => false) },
      mediaServerSync: { isAnySyncInFlight: jest.fn(() => false) },
      watchStatusSync: { getStatus: jest.fn(() => ({ running: false, lastRun: { completedAt: new Date().toISOString() } })), syncAll: jest.fn() },
    };
    runner = require('../operationRunner');
    runner.initialize(deps);
  });

  describe('blocker', () => {
    it('is free when nothing touches downloads', () => {
      expect(runner.blocker()).toBeNull();
    });

    it('waits for a running download', () => {
      deps.jobModule.getInProgressJobId.mockReturnValue('job');
      expect(runner.blocker()).toMatchObject({ reason: 'download-running' });
    });

    it('waits for a task that touches downloads', () => {
      deps.scheduledTaskManager.isTaskRunningById.mockImplementation((id) => id === 'autoRemovalFrequency');
      expect(runner.blocker()).toMatchObject({ reason: 'task-running', message: expect.stringContaining('Automatic video cleanup') });
    });

    it('waits for a startup rescan and a playlist sync', () => {
      deps.videosModule.isBackfillRunning.mockReturnValue(true);
      expect(runner.blocker()).toMatchObject({ reason: 'task-running' });
      deps.videosModule.isBackfillRunning.mockReturnValue(false);
      deps.mediaServerSync.isAnySyncInFlight.mockReturnValue(true);
      expect(runner.blocker()).toMatchObject({ reason: 'task-running' });
    });
  });

  it('previews with the current blocker', async () => {
    deps.jobModule.getInProgressJobId.mockReturnValue('job');
    planner.summarizePlan.mockResolvedValue({ needed: true });

    await runner.preview(CHANGE);

    expect(planner.summarizePlan).toHaveBeenCalledWith(expect.anything(), { blocked: expect.objectContaining({ reason: 'download-running' }) });
  });

  describe('start', () => {
    it('requires the preview\'s revision', async () => {
      await expect(runner.start(CHANGE)).rejects.toMatchObject({ status: 400 });
    });

    it('refuses while a download runs', async () => {
      deps.jobModule.getInProgressJobId.mockReturnValue('job');

      await expect(runner.start(CHANGE, 'rev')).rejects.toMatchObject({ status: 409 });
      expect(lock.isActive()).toBe(false);
    });

    it('refuses a stale preview and releases the lock', async () => {
      await expect(runner.start(CHANGE, 'old')).rejects.toMatchObject({ status: 409, code: 'STALE_PREVIEW' });
      expect(lock.isActive()).toBe(false);
    });

    it('applies the change directly when nothing has to move', async () => {
      planner.buildPlan.mockResolvedValue(plan([]));

      await expect(runner.start(CHANGE, 'rev')).resolves.toEqual({ operationId: null, applied: true });
      expect(applier.applySettings).toHaveBeenCalled();
      expect(store.createOperation).not.toHaveBeenCalled();
      expect(lock.isActive()).toBe(false);
    });

    it('refuses a change none of whose videos could be planned', async () => {
      planner.buildPlan.mockResolvedValue({ ...plan([]), problems: [{ problem: 'no-name' }] });
      planner.applyRefusal.mockReturnValue({ reason: 'problems', message: 'None can move' });

      await expect(runner.start(CHANGE, 'rev')).rejects.toMatchObject({ status: 409, code: 'problems' });
      expect(applier.applySettings).not.toHaveBeenCalled();
      expect(lock.isActive()).toBe(false);
    });

    it('moves every video in the background, holding the lock until it ends', async () => {
      await expect(runner.start(CHANGE, 'rev')).resolves.toEqual({ operationId: 3, applied: false });
      expect(lock.getActive()).toMatchObject({ operationId: 3, label: 'Chan' });
      expect(lock.coversChannel('UC1')).toBe(true);

      await flush(() => !lock.isActive());

      expect(applier.applySettings).toHaveBeenCalledTimes(1);
      expect(store.markSettingsApplied).toHaveBeenCalledWith(operation, [{ ownerChannelId: 'UC1', showId: 9 }]);
      expect(executor.executeItem).toHaveBeenCalledTimes(2);
      expect(executor.executeItem.mock.calls[0][1].showIdFor('UC1')).toBe(9);
      expect(store.finishOperation).toHaveBeenCalledWith(operation, 'completed', null);
      expect(followUp.finishFiles).toHaveBeenCalled();
      expect(followUp.finishServers).toHaveBeenCalledWith(expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ youtubeId: 'vid1' })]),
      }));
      expect(lock.isActive()).toBe(false);
    });

    it('records a partial run when some videos fail', async () => {
      executor.executeItem.mockRejectedValueOnce(new Error('EEXIST'));
      store.refreshCounts.mockResolvedValue({ done: 1, failed: 1, pending: 0 });

      await runner.start(CHANGE, 'rev');
      await flush(() => !lock.isActive());

      expect(store.markItem).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'failed', 'EEXIST', { filesMoved: undefined });
      expect(store.finishOperation).toHaveBeenCalledWith(operation, 'partial', null);
      expect(require('../../mediaServers/watchStatusHolds').releaseUnmovedHolds)
        .toHaveBeenCalledWith({ operationId: 3, videoIds: [1] });
      expect(applier.rollbackSettings).not.toHaveBeenCalled();
    });

    it('undoes the settings change when no video could move', async () => {
      executor.executeItem.mockRejectedValue(new Error('EACCES'));
      store.itemsWithStatus.mockImplementation(async (id, statuses) => (statuses.includes('pending') ? [item(1), item(2)] : []));
      store.refreshCounts.mockResolvedValue({ done: 0, failed: 2, pending: 0, moved: 0 });

      await runner.start(CHANGE, 'rev');
      await flush(() => !lock.isActive());

      expect(applier.rollbackSettings).toHaveBeenCalled();
      expect(store.finishOperation).toHaveBeenCalledWith(operation, 'failed', expect.stringContaining('undone'));
      expect(followUp.finishServers).not.toHaveBeenCalled();
    });

    it('keeps the settings and the holds of videos whose files moved but could not be finished', async () => {
      executor.executeItem.mockRejectedValue(Object.assign(new Error('nfo failed'), { filesMoved: true }));
      store.refreshCounts.mockResolvedValue({ done: 0, failed: 2, pending: 0, moved: 2 });

      await runner.start(CHANGE, 'rev');
      await flush(() => !lock.isActive());

      expect(store.markItem).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'failed', 'nfo failed', { filesMoved: true });
      expect(applier.rollbackSettings).not.toHaveBeenCalled();
      expect(require('../../mediaServers/watchStatusHolds').releaseUnmovedHolds)
        .toHaveBeenCalledWith({ operationId: 3, videoIds: [] });
      expect(store.finishOperation).toHaveBeenCalledWith(operation, 'partial', null);
    });

    it('releases the holds of every video when the run stops before moving', async () => {
      applier.applySettings.mockRejectedValue(new Error('show folder'));

      await runner.start(CHANGE, 'rev');
      await flush(() => !lock.isActive());

      expect(require('../../mediaServers/watchStatusHolds').releaseUnmovedHolds)
        .toHaveBeenCalledWith({ operationId: 3, videoIds: [1, 2] });
      expect(store.finishOperation).toHaveBeenCalledWith(operation, 'failed', 'show folder');
    });

    it('still completes when the follow-up work fails', async () => {
      followUp.finishFiles.mockRejectedValue(new Error('db gone'));

      await runner.start(CHANGE, 'rev');
      await flush(() => !lock.isActive());

      expect(store.finishOperation).toHaveBeenCalledWith(operation, 'completed', null);
    });

    it('syncs watch state first when the last sync is old', async () => {
      deps.watchStatusSync.getStatus.mockReturnValue({ running: false, lastRun: null });
      deps.watchStatusSync.syncAll.mockResolvedValue({});

      await runner.start(CHANGE, 'rev');
      await flush(() => !lock.isActive());

      expect(deps.watchStatusSync.syncAll).toHaveBeenCalledWith('reorganize');
    });

    it('skips that sync when the last one is recent', async () => {
      await runner.start(CHANGE, 'rev');
      await flush(() => !lock.isActive());

      expect(deps.watchStatusSync.syncAll).not.toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    beforeEach(() => {
      operation.status = 'partial';
      operation.settings_applied = true;
      store.findOperation.mockResolvedValue(operation);
      store.itemsWithStatus.mockResolvedValue([item(2)]);
    });

    it('returns 404 for an unknown operation', async () => {
      store.findOperation.mockResolvedValue(null);
      await expect(runner.retry(99)).rejects.toMatchObject({ status: 404 });
    });

    it('refuses while a reorganize runs', async () => {
      const token = lock.acquire({ label: 'other' });
      try {
        await expect(runner.retry(3)).rejects.toMatchObject({ status: 409, code: 'reorganizing' });
      } finally {
        lock.release(token);
      }
    });

    it('retries an operation a crash left running once nothing else runs', async () => {
      operation.status = 'running';
      await expect(runner.retry(3)).resolves.toEqual({ operationId: 3 });
      await flush(() => !lock.isActive());
      expect(executor.executeItem).toHaveBeenCalled();
    });

    it('keeps the holds and settings of a video that moved on an earlier attempt when the retry fails before moving', async () => {
      store.itemsWithStatus.mockImplementation(async (id, statuses) => (
        statuses.includes('pending') ? [{ ...item(2), files_moved: true }] : []
      ));
      executor.executeItem.mockRejectedValue(new Error('The video\'s show could not be found.'));
      store.refreshCounts.mockResolvedValue({ done: 0, failed: 1, pending: 0, moved: 1 });

      await runner.retry(3);
      await flush(() => !lock.isActive());

      expect(require('../../mediaServers/watchStatusHolds').releaseUnmovedHolds)
        .toHaveBeenCalledWith({ operationId: 3, videoIds: [] });
      expect(applier.rollbackSettings).not.toHaveBeenCalled();
      expect(store.finishOperation).toHaveBeenCalledWith(operation, 'partial', null);
    });

    it('releases the holds of a video a retry brought back home', async () => {
      store.itemsWithStatus.mockImplementation(async (id, statuses) => (
        statuses.includes('pending') ? [{ ...item(2), files_moved: true }] : []
      ));
      executor.executeItem.mockRejectedValue(Object.assign(new Error('EEXIST'), { filesMoved: false }));
      store.refreshCounts.mockResolvedValue({ done: 0, failed: 1, pending: 0, moved: 0 });

      await runner.retry(3);
      await flush(() => !lock.isActive());

      expect(require('../../mediaServers/watchStatusHolds').releaseUnmovedHolds)
        .toHaveBeenCalledWith({ operationId: 3, videoIds: [2] });
      expect(store.markItem).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }), 'failed', 'EEXIST', { filesMoved: false });
    });

    it('retries the videos a stopped run never reached', async () => {
      store.itemsWithStatus.mockImplementation(async (id, statuses) => (statuses.includes('pending') ? [item(2)] : []));
      await expect(runner.retry(3)).resolves.toEqual({ operationId: 3 });
      await flush(() => !lock.isActive());
      expect(executor.executeItem).toHaveBeenCalledTimes(1);
    });

    it('refuses when a newer reorganize changed the same channels', async () => {
      store.hasNewerOperationFor.mockResolvedValue(true);
      await expect(runner.retry(3)).rejects.toMatchObject({ status: 409 });
      expect(lock.isActive()).toBe(false);
    });

    it('runs the failed videos again without reapplying the settings', async () => {
      await expect(runner.retry(3)).resolves.toEqual({ operationId: 3 });
      await flush(() => !lock.isActive());

      expect(store.resetFailedItems).toHaveBeenCalledWith(3);
      expect(store.reopenOperation).toHaveBeenCalledWith(operation);
      expect(applier.applySettings).not.toHaveBeenCalled();
      expect(executor.executeItem).toHaveBeenCalled();
    });
  });

  it('resumes an interrupted operation at startup without a fresh sync', async () => {
    deps.watchStatusSync.getStatus.mockReturnValue({ running: false, lastRun: null });
    operation.settings_applied = true;
    store.findUnfinished.mockResolvedValue([operation]);

    await runner.recover();

    expect(executor.executeItem).toHaveBeenCalledTimes(2);
    expect(deps.watchStatusSync.syncAll).not.toHaveBeenCalled();
    expect(applier.applySettings).not.toHaveBeenCalled();
    expect(lock.isActive()).toBe(false);
  });

  it('runs the follow-up for the videos moved before the restart as well', async () => {
    operation.settings_applied = true;
    store.findUnfinished.mockResolvedValue([operation]);
    store.itemsWithStatus.mockImplementation(async (id, statuses) => (
      statuses.includes('pending') ? [item(2)] : [item(1), item(2)]
    ));

    await runner.recover();

    expect(executor.executeItem).toHaveBeenCalledTimes(1);
    const finished = followUp.finishFiles.mock.calls[0][0].items.map((entry) => entry.youtubeId);
    expect(finished).toEqual(['vid1', 'vid2']);
    expect(followUp.finishServers).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({ youtubeId: 'vid1' })]),
    }));
  });

  it('leaves an interrupted operation for later when startup work is still running at the deadline', async () => {
    jest.useFakeTimers();
    try {
      deps.jobModule.getInProgressJobId.mockReturnValue('job');
      store.findUnfinished.mockResolvedValue([operation]);

      const recovery = runner.recover();
      await jest.advanceTimersByTimeAsync(31 * 60 * 1000);
      await recovery;

      expect(executor.executeItem).not.toHaveBeenCalled();
      expect(store.finishOperation).toHaveBeenCalledWith(operation, 'failed', expect.stringContaining('Retry'));
      expect(lock.isActive()).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('refuses to move when a download started while the plan was computed', async () => {
    planner.buildPlan.mockImplementation(async () => {
      deps.jobModule.getInProgressJobId.mockReturnValue('job');
      return plan();
    });

    await expect(runner.start(CHANGE, 'rev')).rejects.toMatchObject({ status: 409, code: 'download-running' });
    expect(store.createOperation).not.toHaveBeenCalled();
    expect(lock.isActive()).toBe(false);
  });
});
