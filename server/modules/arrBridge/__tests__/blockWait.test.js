/* eslint-env jest */
const { createBlockWait, BLOCK_RETRY_MS, BLOCK_GIVE_UP_MS } = require('../blockWait');

const START = new Date('2025-06-10T12:00:00.000Z').getTime();

function setup({ cookieKey = 'key-1' } = {}) {
  const clock = { time: START };
  const cookies = { key: cookieKey };
  const getCookieKey = jest.fn(() => cookies.key);
  const block = createBlockWait({ now: () => new Date(clock.time), getCookieKey });
  return { block, clock, cookies, getCookieKey };
}

describe('blockWait', () => {
  it('has a try due before anything was blocked', () => {
    const { block } = setup();

    expect(block.isDue()).toBe(true);
    expect(block.nextTryAt()).toBeNull();
  });

  it('holds the next try for an hour after a block', () => {
    const { block, clock } = setup();
    block.recordBlocked();

    clock.time = START + BLOCK_RETRY_MS - 1;

    expect(block.isDue()).toBe(false);
    expect(block.nextTryAt()).toEqual(new Date(START + BLOCK_RETRY_MS));
  });

  it('has a try due once the hour has passed', () => {
    const { block, clock } = setup();
    block.recordBlocked();

    clock.time = START + BLOCK_RETRY_MS;

    expect(block.isDue()).toBe(true);
    expect(block.nextTryAt()).toBeNull();
  });

  it('counts the hour from the latest block', () => {
    const { block, clock } = setup();
    block.recordBlocked();
    clock.time = START + BLOCK_RETRY_MS;
    block.recordBlocked();

    clock.time = START + BLOCK_RETRY_MS + 1;

    expect(block.isDue()).toBe(false);
  });

  it('has a try due at once after a download got through', () => {
    const { block } = setup();
    block.recordBlocked();

    block.recordSuccess();

    expect(block.isDue()).toBe(true);
    expect(block.nextTryAt()).toBeNull();
  });

  it('suspects no block before one happened', () => {
    const { block } = setup();

    expect(block.isSuspected()).toBe(false);
  });

  it('keeps suspecting a block after the hour, until a download gets through', () => {
    const { block, clock } = setup();
    block.recordBlocked();
    clock.time = START + BLOCK_RETRY_MS * 3;
    expect(block.isSuspected()).toBe(true);

    block.recordSuccess();

    expect(block.isSuspected()).toBe(false);
  });

  it('forgets a block a day after the last blocked download', () => {
    const { block, clock } = setup();
    block.recordBlocked();

    clock.time = START + BLOCK_GIVE_UP_MS - 1;
    expect(block.isSuspected()).toBe(true);

    clock.time = START + BLOCK_GIVE_UP_MS;
    expect(block.isSuspected()).toBe(false);
  });

  it('still suspects the block when the cookies changed, though a try is due', () => {
    const { block, cookies } = setup();
    block.recordBlocked();

    cookies.key = 'key-2';

    expect(block.isDue()).toBe(true);
    expect(block.isSuspected()).toBe(true);
  });

  it.each([
    ['replaced', 'key-2'],
    ['removed', null],
  ])('has a try due at once when the cookies are %s', (_name, nextKey) => {
    const { block, cookies } = setup();
    block.recordBlocked();

    cookies.key = nextKey;

    expect(block.isDue()).toBe(true);
    expect(block.nextTryAt()).toBeNull();
  });

  it('has a try due at once when cookies are added to a server that had none', () => {
    const { block, cookies } = setup({ cookieKey: null });
    block.recordBlocked();
    expect(block.isDue()).toBe(false);

    cookies.key = 'key-1';

    expect(block.isDue()).toBe(true);
  });

  it('keeps waiting when the cookie file cannot be read', () => {
    const { block, getCookieKey } = setup();
    block.recordBlocked();

    getCookieKey.mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(block.isDue()).toBe(false);
  });

  it('expires a grab a day after its first block', () => {
    const { block, clock } = setup();
    const grab = { blocked_at: new Date(START) };

    clock.time = START + BLOCK_GIVE_UP_MS - 1;
    expect(block.isExpired(grab)).toBe(false);

    clock.time = START + BLOCK_GIVE_UP_MS;
    expect(block.isExpired(grab)).toBe(true);
  });

  it('never expires a grab that was not blocked', () => {
    const { block } = setup();

    expect(block.isExpired({ blocked_at: null })).toBe(false);
  });

  it('knows whether a download got through since a given moment', () => {
    const { block, clock } = setup();
    expect(block.gotThroughSince(new Date(START - 1000))).toBe(false);

    clock.time = START + 5000;
    block.recordSuccess();

    expect(block.gotThroughSince(new Date(START))).toBe(true);
    expect(block.gotThroughSince(new Date(START + 5000))).toBe(false);
    expect(block.gotThroughSince('2025-06-10T12:00:04.000Z')).toBe(true);
  });

  it('remembers which grabs passed the due try on, until they are reset', () => {
    const { block } = setup();

    block.passTry('grab-1');
    expect(block.hasPassedTry('grab-1')).toBe(true);
    expect(block.hasPassedTry('grab-2')).toBe(false);

    block.resetPassedTries();
    expect(block.hasPassedTry('grab-1')).toBe(false);
  });

  it('remembers a forced grab until it is released', () => {
    const { block } = setup();

    block.force('grab-1');
    expect(block.isForced('grab-1')).toBe(true);
    expect(block.isForced('grab-2')).toBe(false);

    block.release('grab-1');
    expect(block.isForced('grab-1')).toBe(false);
  });

  it('reports the state the sweep last saw', () => {
    const { block } = setup();
    expect(block.isActive()).toBe(false);

    block.setActive(true);

    expect(block.isActive()).toBe(true);
  });
});
