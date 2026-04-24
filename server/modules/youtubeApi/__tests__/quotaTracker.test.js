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

  test('starts with quota available', () => {
    expect(quotaTracker.isInCooldown()).toBe(false);
  });

  test('goes into cooldown when markExhausted is called', () => {
    quotaTracker.markExhausted();
    expect(quotaTracker.isInCooldown()).toBe(true);
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
});
