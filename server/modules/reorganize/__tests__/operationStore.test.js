jest.mock('../../../db', () => ({
  sequelize: {
    transaction: jest.fn(async (work) => work('tx')),
    fn: jest.fn((name, col) => `${name}(${col})`),
    col: jest.fn((name) => name),
  },
}));
jest.mock('../../../models/tvreorganizeoperation', () => ({ create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() }));
jest.mock('../../../models/tvreorganizeitem', () => ({
  bulkCreate: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), count: jest.fn(), update: jest.fn(),
}));

const plan = {
  context: { type: 'channel', scope: 'UC1', label: 'Chan', stored: { type: 'channel', channelId: 'UC1', subFolder: 'TV' } },
  shows: [{ ownerChannelId: 'UC1', action: 'create' }],
  revision: 'rev',
  items: [{
    videoId: 1, youtubeId: 'abcdefghijk', channelId: 'UC1', title: 'Big Build',
    files: [{ from: '/a', to: '/b', size: 1, mtimeMs: 2 }], nfoSources: [], sourceDirs: ['/'], destDir: '/',
    oldVideoPath: '/a', newVideoPath: '/b', oldAudioPath: null, newAudioPath: null,
    layout: 'tv', libraryFolder: 'TV', fromLayout: 'videos', fromLibraryFolder: 'Kids',
    classification: { season: 2024 },
  }],
};

describe('reorganize operationStore', () => {
  let store;
  let TvReorganizeOperation;
  let TvReorganizeItem;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    TvReorganizeOperation = require('../../../models/tvreorganizeoperation');
    TvReorganizeItem = require('../../../models/tvreorganizeitem');
    TvReorganizeOperation.create.mockImplementation(async (values) => ({ id: 3, ...values }));
    store = require('../operationStore');
  });

  it('keeps a title show change\'s snapshot with the change', async () => {
    const snapshot = { shows: [], rows: [{ youtube_id: 'abcdefghijk' }], conflicts: [] };
    const operation = await store.createOperation({ ...plan, snapshot });
    expect(store.settingsOf(operation).snapshot).toEqual(snapshot);
  });

  it('records the operation and its items in one transaction', async () => {
    const operation = await store.createOperation(plan);

    expect(operation).toMatchObject({ id: 3, change_type: 'channel', status: 'running', total_items: 1, revision: 'rev' });
    expect(JSON.parse(operation.settings_change)).toEqual({ change: plan.context.stored, label: 'Chan', shows: plan.shows });
    const [rows, options] = TvReorganizeItem.bulkCreate.mock.calls[0];
    expect(options).toEqual({ transaction: 'tx' });
    expect(rows[0]).toMatchObject({ operation_id: 3, youtube_id: 'abcdefghijk', video_id: 1, status: 'pending' });
    expect(JSON.parse(rows[0].files).files).toEqual([{ from: '/a', to: '/b' }]);
    expect(JSON.parse(rows[0].classification)).toEqual({ season: 2024 });
  });

  it('stores the pinned shows when the settings are applied', async () => {
    const operation = { settings_change: JSON.stringify({ change: {}, label: 'Chan', shows: [] }), update: jest.fn() };

    await store.markSettingsApplied(operation, [{ ownerChannelId: 'UC1', showId: 9 }]);

    expect(operation.update).toHaveBeenCalledWith({
      settings_change: JSON.stringify({ change: {}, label: 'Chan', shows: [{ ownerChannelId: 'UC1', showId: 9 }] }),
      settings_applied: true,
    });
  });

  it('recounts item statuses into the operation, with the items whose files moved', async () => {
    TvReorganizeItem.findAll.mockResolvedValue([{ status: 'done', count: '4' }, { status: 'failed', count: 1 }]);
    TvReorganizeItem.count.mockResolvedValue(5);
    const operation = { id: 3, update: jest.fn() };

    await expect(store.refreshCounts(operation)).resolves.toEqual({ done: 4, failed: 1, pending: 0, moved: 5 });
    expect(TvReorganizeItem.count).toHaveBeenCalledWith({ where: { operation_id: 3, files_moved: true } });
    expect(operation.update).toHaveBeenCalledWith({ done_items: 4, failed_items: 1 });
  });

  it('records whether a failed item\'s files had moved, and a done item\'s always did', async () => {
    const item = { update: jest.fn() };

    await store.markItem(item, 'failed', 'nfo failed', { filesMoved: true });
    await store.markItem(item, 'failed', 'EEXIST');
    await store.markItem(item, 'done');

    expect(item.update.mock.calls.map(([values]) => values.files_moved)).toEqual([true, false, true]);
  });

  it('keeps a stored "files moved" when a later attempt failed before reaching the files', async () => {
    const item = { files_moved: true, update: jest.fn() };

    await store.markItem(item, 'failed', 'show could not be found');

    expect(item.update.mock.calls[0][0].files_moved).toBe(true);
  });

  it('clears a stored "files moved" when a later attempt brought every file home', async () => {
    const item = { files_moved: true, update: jest.fn() };

    await store.markItem(item, 'failed', 'EEXIST', { filesMoved: false });

    expect(item.update.mock.calls[0][0].files_moved).toBe(false);
  });

  it('describes an operation with its failed videos', async () => {
    TvReorganizeOperation.findByPk.mockResolvedValue({
      id: 3, change_type: 'channel', status: 'partial', total_items: 2, done_items: 1, failed_items: 1, error: null,
      started_at: null, finished_at: null, settings_change: JSON.stringify({ change: { type: 'channel' }, label: 'Chan', shows: [] }),
    });
    TvReorganizeItem.findAll.mockResolvedValue([{ id: 8, youtube_id: 'abcdefghijk', title: 'T', channel_id: 'UC1', error: 'EEXIST' }]);

    await expect(store.getOperationView(3)).resolves.toMatchObject({
      id: 3, label: 'Chan', status: 'partial', total: 2, done: 1, failed: 1,
      failedItems: [{ id: 8, youtubeId: 'abcdefghijk', error: 'EEXIST' }],
    });
  });

  it('says which failed videos already had their files moved', async () => {
    TvReorganizeOperation.findByPk.mockResolvedValue({
      id: 3, change_type: 'titleShows', status: 'partial', total_items: 2, done_items: 0, failed_items: 2, error: null,
      started_at: null, finished_at: null, settings_change: JSON.stringify({ change: { type: 'titleShows' }, label: 'Chan', shows: [] }),
    });
    TvReorganizeItem.findAll.mockResolvedValue([
      { id: 8, youtube_id: 'abcdefghijk', title: 'T', channel_id: 'UC1', error: 'EEXIST', files_moved: false },
      { id: 9, youtube_id: 'bcdefghijkl', title: 'U', channel_id: 'UC1', error: 'finishing failed', files_moved: true },
    ]);

    const view = await store.getOperationView(3);

    expect(view.failedItems.map((item) => item.filesMoved)).toEqual([false, true]);
  });

  it('returns null for an unknown operation', async () => {
    TvReorganizeOperation.findByPk.mockResolvedValue(null);

    await expect(store.getOperationView(99)).resolves.toBeNull();
  });

  it('reports the videos of a channel the newest operation left unmoved', async () => {
    TvReorganizeItem.findOne.mockResolvedValue({ operation_id: 3 });
    TvReorganizeOperation.findByPk.mockResolvedValue({ id: 3, status: 'partial' });
    TvReorganizeItem.count.mockResolvedValue(2);

    await expect(store.unmovedForChannel('UC1')).resolves.toEqual({ operationId: 3, failed: 2, status: 'partial' });
    expect(TvReorganizeItem.count).toHaveBeenCalledWith({
      where: { operation_id: 3, channel_id: 'UC1', status: ['failed', 'pending'] },
    });
  });

  it('lists the videos a finished operation never reached among the ones to retry', async () => {
    TvReorganizeOperation.findByPk.mockResolvedValue({
      id: 3, change_type: 'channel', status: 'partial', total_items: 2, done_items: 1, failed_items: 0, error: 'interrupted',
      started_at: null, finished_at: null, settings_change: JSON.stringify({ change: { type: 'channel' }, label: 'Chan', shows: [] }),
    });
    TvReorganizeItem.findAll.mockResolvedValue([{ id: 8, youtube_id: 'abcdefghijk', title: 'T', channel_id: 'UC1', error: null }]);

    await expect(store.getOperationView(3)).resolves.toMatchObject({ failedItems: [{ id: 8 }] });
    expect(TvReorganizeItem.findAll.mock.calls[0][0].where).toEqual({ operation_id: 3, status: ['failed', 'pending'] });
  });

  it('lists only the failed videos of an operation that is still running', async () => {
    TvReorganizeOperation.findByPk.mockResolvedValue({
      id: 3, change_type: 'channel', status: 'running', total_items: 2, done_items: 0, failed_items: 1, error: null,
      started_at: null, finished_at: null, settings_change: JSON.stringify({ change: { type: 'channel' }, label: 'Chan', shows: [] }),
    });
    TvReorganizeItem.findAll.mockResolvedValue([]);

    await store.getOperationView(3);

    expect(TvReorganizeItem.findAll.mock.calls[0][0].where).toEqual({ operation_id: 3, status: ['failed'] });
  });

  it('truncates long errors', async () => {
    const item = { update: jest.fn() };

    await store.markItem(item, 'failed', 'x'.repeat(2000));

    expect(item.update.mock.calls[0][0].error).toHaveLength(1000);
  });

  it('finds a newer operation that covers the same channels', async () => {
    TvReorganizeItem.findOne.mockResolvedValue({ id: 20 });

    await expect(store.hasNewerOperationFor(3, ['UC1'])).resolves.toBe(true);
    await expect(store.hasNewerOperationFor(3, [])).resolves.toBe(false);
  });
});
