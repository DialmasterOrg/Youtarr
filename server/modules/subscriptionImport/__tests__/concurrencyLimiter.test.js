const createLimiter = require('../concurrencyLimiter');

describe('concurrencyLimiter', () => {
  test('runs no more than N tasks in parallel', async () => {
    const limit = createLimiter(3);
    let inFlight = 0;
    let peak = 0;

    const makeTask = () => async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
      return 'done';
    };

    const results = await Promise.all(
      Array.from({ length: 12 }, () => limit(makeTask()))
    );

    expect(results).toHaveLength(12);
    expect(results.every((r) => r === 'done')).toBe(true);
    expect(peak).toBeLessThanOrEqual(3);
  });

  test('propagates task errors', async () => {
    const limit = createLimiter(2);
    await expect(limit(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
