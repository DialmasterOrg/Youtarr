jest.mock('../operationRunner', () => ({
  initialize: jest.fn(), preview: jest.fn(), start: jest.fn(), retry: jest.fn(), recover: jest.fn(),
  EXCLUSIVE_TASKS: { videoRescanFrequency: 'The filesystem rescan' },
}));
jest.mock('../operationStore', () => ({ getOperationView: jest.fn(), unmovedForChannel: jest.fn() }));

describe('reorganize module', () => {
  let reorganize;
  let lock;
  let operationStore;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    reorganize = require('..');
    lock = require('../reorganizeLock');
    operationStore = require('../operationStore');
  });

  it('blocks only the tasks that touch downloads while a reorganize runs', () => {
    const scheduledTaskManager = { setExclusiveBlocker: jest.fn() };
    reorganize.initialize({ scheduledTaskManager });
    const blockerFor = scheduledTaskManager.setExclusiveBlocker.mock.calls[0][0];

    expect(blockerFor('videoRescanFrequency')).toBeNull();
    const token = lock.acquire({ label: 'Chan' });
    expect(blockerFor('videoRescanFrequency')).toMatchObject({ reason: 'reorganizing' });
    expect(blockerFor('channelDownloadFrequency')).toBeNull();
    lock.release(token);
  });

  it('reports a reorganize that is still planning as starting', async () => {
    const token = lock.acquire({ label: 'Chan' });

    await expect(reorganize.getActive()).resolves.toEqual({ id: null, label: 'Chan', status: 'starting' });
    lock.release(token);
  });

  it('reports no active reorganize when the lock is free', async () => {
    await expect(reorganize.getActive()).resolves.toBeNull();
  });

  it('describes a channel\'s reorganize state', async () => {
    operationStore.unmovedForChannel.mockResolvedValue({ operationId: 3, failed: 1, status: 'partial' });
    const token = lock.acquire({ label: 'Chan' });
    lock.setScope(token, { channelIds: ['UC1'] });

    await expect(reorganize.channelState('UC1')).resolves.toEqual({
      running: true, unmoved: { operationId: 3, failed: 1, status: 'partial' },
    });
    lock.release(token);
  });
});
