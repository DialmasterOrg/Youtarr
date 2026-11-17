/* eslint-env jest */
const { createSearchQueue, SearchUnavailableError } = require('../searchQueue');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('searchQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('answers a repeated key from the cache', async () => {
    const queue = createSearchQueue();
    const work = jest.fn().mockResolvedValue(['a']);

    expect(await queue.run('k', work)).toEqual(['a']);
    expect(await queue.run('k', work)).toEqual(['a']);

    expect(work).toHaveBeenCalledTimes(1);
  });

  test('runs the work again once the cache entry expires', async () => {
    const queue = createSearchQueue({ cacheTtlMs: 1000 });
    const work = jest.fn().mockResolvedValue(['a']);

    await queue.run('k', work);
    jest.advanceTimersByTime(1001);
    await queue.run('k', work);

    expect(work).toHaveBeenCalledTimes(2);
  });

  test('two callers with one key share a single run', async () => {
    const queue = createSearchQueue();
    const gate = deferred();
    const work = jest.fn(() => gate.promise);

    const first = queue.run('k', work);
    const second = queue.run('k', work);
    gate.resolve(['a']);

    expect(await first).toEqual(['a']);
    expect(await second).toEqual(['a']);
    expect(work).toHaveBeenCalledTimes(1);
  });

  test('holds a call while the running limit is reached and starts it when a slot frees', async () => {
    const queue = createSearchQueue({ maxConcurrent: 2 });
    const gates = [deferred(), deferred()];
    const third = jest.fn().mockResolvedValue('c');

    const first = queue.run('a', () => gates[0].promise);
    const second = queue.run('b', () => gates[1].promise);
    const held = queue.run('c', third);
    await Promise.resolve();
    expect(third).not.toHaveBeenCalled();

    gates[0].resolve('a');
    await first;
    expect(await held).toBe('c');
    gates[1].resolve('b');
    await second;
  });

  test('holds a call past the rate limit until the window moves on', async () => {
    const queue = createSearchQueue({ maxPerWindow: 2, windowMs: 20_000 });
    await queue.run('a', async () => 1);
    await queue.run('b', async () => 2);
    const work = jest.fn().mockResolvedValue(3);

    const held = queue.run('c', work);
    await Promise.resolve();
    expect(work).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(20_001);
    expect(await held).toBe(3);
  });

  test('with the default limits a fast burst is held, never refused', async () => {
    const queue = createSearchQueue();
    const outcomes = [];
    // A bulk search with a YouTube API key: thirty quick searches, one after another.
    const burst = (async () => {
      for (let index = 0; index < 30; index += 1) {
        outcomes.push(await queue.run(`search-${index}`, async () => index).catch((error) => error));
      }
    })();

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    await burst;

    expect(outcomes).toEqual(Array.from({ length: 30 }, (_, index) => index));
  });

  test('refuses a call that was held longer than the hold limit', async () => {
    const queue = createSearchQueue({ maxConcurrent: 1, holdLimitMs: 30_000 });
    const gate = deferred();
    const running = queue.run('a', () => gate.promise);
    const work = jest.fn();

    const held = queue.run('b', work);
    const outcome = held.catch((error) => error);
    await jest.advanceTimersByTimeAsync(30_001);

    const error = await outcome;
    expect(error).toBeInstanceOf(SearchUnavailableError);
    expect(error.reason).toBe('hold-timeout');
    expect(work).not.toHaveBeenCalled();
    gate.resolve('a');
    await running;
  });

  test('a call that timed out while held does not take a slot later', async () => {
    const queue = createSearchQueue({ maxConcurrent: 1, holdLimitMs: 1000 });
    const gate = deferred();
    const running = queue.run('a', () => gate.promise);
    const held = queue.run('b', jest.fn()).catch((error) => error);
    await jest.advanceTimersByTimeAsync(1001);
    await held;

    gate.resolve('a');
    await running;

    expect(await queue.run('c', async () => 'c')).toBe('c');
  });

  test('wraps a failed search and does not cache it', async () => {
    const queue = createSearchQueue();
    const cause = new Error('yt-dlp timed out');
    const work = jest.fn().mockRejectedValueOnce(cause).mockResolvedValueOnce(['a']);

    const error = await queue.run('k', work).catch((caught) => caught);
    expect(error).toBeInstanceOf(SearchUnavailableError);
    expect(error.reason).toBe('search-failed');
    expect(error.cause).toBe(cause);

    expect(await queue.run('k', work)).toEqual(['a']);
  });

  test('frees the slot of a failed search', async () => {
    const queue = createSearchQueue({ maxConcurrent: 1 });
    await queue.run('a', async () => { throw new Error('boom'); }).catch(() => {});

    expect(await queue.run('b', async () => 'b')).toBe('b');
  });

  test('forgets the oldest entry once the cache is full', async () => {
    const queue = createSearchQueue({ cacheMaxEntries: 2, maxPerWindow: 100 });
    const work = jest.fn().mockResolvedValue('x');

    await queue.run('a', work);
    await queue.run('b', work);
    await queue.run('c', work);
    await queue.run('a', work);

    expect(work).toHaveBeenCalledTimes(4);
  });
});
