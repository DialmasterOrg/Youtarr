const { ReorganizeLock, REORGANIZE_BLOCK_REASON } = require('../reorganizeLock');

describe('reorganizeLock', () => {
  let lock;

  beforeEach(() => {
    lock = new ReorganizeLock();
  });

  it('is free until acquired', () => {
    expect(lock.isActive()).toBe(false);
    expect(lock.runBlocker()).toBeNull();
  });

  it('refuses a second reorganize with a 409', () => {
    lock.acquire({ label: 'Chan' });

    expect(() => lock.acquire({ label: 'Other' })).toThrow(expect.objectContaining({ status: 409 }));
  });

  it('reports the scope it covers', () => {
    const token = lock.acquire({ label: 'Chan' });
    lock.setScope(token, { operationId: 4, channelIds: ['UC1'], videoIds: [7], youtubeIds: ['abc'] });

    expect(lock.getActive()).toMatchObject({ operationId: 4, label: 'Chan' });
    expect(lock.coversChannel('UC1')).toBe(true);
    expect(lock.coversChannel('UC2')).toBe(false);
    expect(lock.coversAnyVideo({ ids: ['7'] })).toBe(true);
    expect(lock.coversAnyVideo({ youtubeIds: ['abc'] })).toBe(true);
    expect(lock.coversAnyVideo({ ids: [8], youtubeIds: ['xyz'] })).toBe(false);
  });

  it('blocks scheduled tasks while held', () => {
    lock.acquire({ label: 'Chan' });

    expect(lock.runBlocker()).toEqual({ reason: REORGANIZE_BLOCK_REASON, message: expect.stringContaining('Chan') });
  });

  it('throws 409 errors for covered channels and videos', () => {
    const token = lock.acquire({ label: 'Chan' });
    lock.setScope(token, { channelIds: ['UC1'], youtubeIds: ['abc'] });

    expect(() => lock.assertChannelFree('UC1')).toThrow(expect.objectContaining({ status: 409, code: 'REORGANIZE_RUNNING' }));
    expect(() => lock.assertChannelFree('UC2')).not.toThrow();
    expect(() => lock.assertVideosFree({ youtubeIds: ['abc'] })).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => lock.assertInactive()).toThrow(expect.objectContaining({ status: 409 }));
  });

  it('emits released and frees the lock on release', () => {
    const released = jest.fn();
    lock.on('released', released);
    const token = lock.acquire({ label: 'Chan' });

    lock.release(token);

    expect(lock.isActive()).toBe(false);
    expect(released).toHaveBeenCalledTimes(1);
  });

  it('ignores a release with a stale token', () => {
    const released = jest.fn();
    lock.on('released', released);
    lock.release({});
    const token = lock.acquire({ label: 'Chan' });
    lock.release({});

    expect(lock.isActive()).toBe(true);
    expect(released).not.toHaveBeenCalled();
    lock.release(token);
  });
});
