jest.mock('../../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('quotaTracker', () => {
  let quotaTracker;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    quotaTracker = require('../quotaTracker');
    quotaTracker.reset();
  });

  // Pacific midnight is the next 00:00 in America/Los_Angeles. Returns a UTC
  // ISO string the test can compare against the cooldownUntil Date.
  const expectedMidnightAfter = (instant) => {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = {};
    for (const p of fmt.formatToParts(instant)) parts[p.type] = p.value;
    const next = new Date(Date.UTC(
      parseInt(parts.year, 10),
      parseInt(parts.month, 10) - 1,
      parseInt(parts.day, 10) + 1,
    ));
    let guess = Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
    const target = guess;
    for (let i = 0; i < 3; i++) {
      const w = {};
      for (const p of fmt.formatToParts(new Date(guess))) w[p.type] = p.value;
      const wallMs = Date.UTC(
        parseInt(w.year, 10),
        parseInt(w.month, 10) - 1,
        parseInt(w.day, 10),
        parseInt(w.hour, 10),
        parseInt(w.minute, 10),
        parseInt(w.second, 10),
      );
      const delta = target - wallMs;
      if (delta === 0) break;
      guess += delta;
    }
    return new Date(guess);
  };

  test('starts with quota available', () => {
    expect(quotaTracker.isInCooldown()).toBe(false);
  });

  test('goes into cooldown when markExhausted is called', () => {
    quotaTracker.markExhausted();
    expect(quotaTracker.isInCooldown()).toBe(true);
  });

  test('cooldown applies only to the exhausted key when one is known', () => {
    quotaTracker.markExhausted('old-key');

    expect(quotaTracker.isInCooldown('old-key')).toBe(true);
    expect(quotaTracker.isInCooldown('replacement-key')).toBe(false);
  });

  test('reports cooldown until-time after markExhausted', () => {
    quotaTracker.markExhausted();
    const until = quotaTracker.getCooldownUntil();
    expect(until).toBeInstanceOf(Date);
    expect(until.getTime()).toBeGreaterThan(Date.now());
  });

  test('exits cooldown when clock advances past reset time', () => {
    jest.useFakeTimers();
    try {
      quotaTracker.markExhausted();
      expect(quotaTracker.isInCooldown()).toBe(true);
      // Advance 25 hours - guarantees we are past the next Pacific midnight.
      jest.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
      expect(quotaTracker.isInCooldown()).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test('reset clears cooldown immediately', () => {
    quotaTracker.markExhausted();
    quotaTracker.reset();
    expect(quotaTracker.isInCooldown()).toBe(false);
  });

  test('cooldown lands on the next Pacific midnight on a regular non-DST day', () => {
    jest.useFakeTimers();
    try {
      // 2026-04-25T20:00:00Z = 13:00 PDT (UTC-7) on Apr 25.
      // Next Pacific midnight = 2026-04-26T07:00:00Z.
      jest.setSystemTime(new Date('2026-04-25T20:00:00Z'));
      quotaTracker.markExhausted();
      const until = quotaTracker.getCooldownUntil();
      expect(until.toISOString()).toBe('2026-04-26T07:00:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });

  test('cooldown is correct on DST fall-back day (PDT -> PST shifts the offset)', () => {
    // DST fall-back in 2026 is 2026-11-01 at 02:00 PDT (=09:00 UTC).
    // 2026-11-01T07:30:00Z = 00:30 PDT (still UTC-7, before the shift).
    // The next Pacific midnight is 2026-11-02T00:00:00 PST = 2026-11-02T08:00:00Z,
    // NOT 2026-11-02T07:00:00Z. The naive "compute offset at now, apply to
    // tomorrow midnight" version was off by an hour here.
    jest.useFakeTimers();
    try {
      const now = new Date('2026-11-01T07:30:00Z');
      jest.setSystemTime(now);
      quotaTracker.markExhausted();
      const until = quotaTracker.getCooldownUntil();
      expect(until.toISOString()).toBe('2026-11-02T08:00:00.000Z');
      // And matches the locally-computed expectation, as a sanity check.
      expect(until.getTime()).toBe(expectedMidnightAfter(now).getTime());
    } finally {
      jest.useRealTimers();
    }
  });

  test('cooldown is correct on DST spring-forward day (PST -> PDT shifts the offset)', () => {
    // DST spring-forward in 2026 is 2026-03-08 at 02:00 PST (=10:00 UTC).
    // 2026-03-08T09:30:00Z = 01:30 PST on Mar 8 (just before the shift). The
    // next Pacific midnight is 2026-03-09T00:00:00 PDT = 2026-03-09T07:00:00Z,
    // NOT 2026-03-09T08:00:00Z. The naive offset-at-now approach was off by
    // an hour here because the offset shifts from -8 to -7 between now and
    // tomorrow midnight.
    jest.useFakeTimers();
    try {
      const now = new Date('2026-03-08T09:30:00Z');
      jest.setSystemTime(now);
      quotaTracker.markExhausted();
      const until = quotaTracker.getCooldownUntil();
      expect(until.toISOString()).toBe('2026-03-09T07:00:00.000Z');
      expect(until.getTime()).toBe(expectedMidnightAfter(now).getTime());
    } finally {
      jest.useRealTimers();
    }
  });
});
