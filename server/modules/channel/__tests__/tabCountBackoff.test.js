/* eslint-env jest */

jest.mock('../../configModule', () => ({ getCookiesPath: jest.fn(() => null) }));

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NOW = Date.parse('2026-09-27T12:00:00.000Z');
const TASK_KEY = 'channelVideoCountsFrequency';

describe('tabCountBackoff', () => {
  let tabCountBackoff;
  let configModule;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    configModule = require('../../configModule');
    tabCountBackoff = require('../tabCountBackoff');
  });

  const historyWith = (run) => ({ getLatestRun: jest.fn().mockResolvedValue(run) });

  describe('remainingMs', () => {
    test('is 0 before YouTube pushed back', async () => {
      expect(await tabCountBackoff.remainingMs('bulk', NOW)).toBe(0);
    });

    test('is 0 once the backoff has passed', async () => {
      await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW);

      expect(await tabCountBackoff.remainingMs('bulk', NOW + 6 * HOUR_MS)).toBe(0);
    });
  });

  describe('start', () => {
    test('pauses every refresh for 6 hours after a rate limit', async () => {
      await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW);

      expect(await tabCountBackoff.remainingMs('on-demand', NOW)).toBe(6 * HOUR_MS);
    });

    test('pauses only bulk refreshes after a bot check on a bulk lookup when cookies are configured', async () => {
      configModule.getCookiesPath.mockReturnValue('/config/cookies.user.txt');
      await tabCountBackoff.start({ reason: 'bot-check', bulk: true }, NOW);

      expect([
        await tabCountBackoff.remainingMs('bulk', NOW),
        await tabCountBackoff.remainingMs('on-demand', NOW),
      ]).toEqual([6 * HOUR_MS, 0]);
    });

    test('pauses every refresh after a bot check on a bulk lookup when no cookies are configured', async () => {
      await tabCountBackoff.start({ reason: 'bot-check', bulk: true }, NOW);

      expect(await tabCountBackoff.remainingMs('on-demand', NOW)).toBe(6 * HOUR_MS);
    });

    test('pauses every refresh after a bot check on a lookup that sent cookies', async () => {
      configModule.getCookiesPath.mockReturnValue('/config/cookies.user.txt');
      await tabCountBackoff.start({ reason: 'bot-check', bulk: false }, NOW);

      expect(await tabCountBackoff.remainingMs('on-demand', NOW)).toBe(6 * HOUR_MS);
    });

    test('keeps pausing every refresh when a bulk bot check follows a pause for all refreshes', async () => {
      configModule.getCookiesPath.mockReturnValue('/config/cookies.user.txt');
      await tabCountBackoff.start({ reason: 'rate-limit', bulk: false }, NOW);
      await tabCountBackoff.start({ reason: 'bot-check', bulk: true }, NOW + HOUR_MS);

      expect(await tabCountBackoff.remainingMs('on-demand', NOW + HOUR_MS)).toBe(12 * HOUR_MS);
    });

    test('doubles the pause on consecutive throttles up to 24 hours', async () => {
      const durations = [];
      for (let i = 0; i < 4; i += 1) {
        durations.push((await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW)).backoffMs / HOUR_MS);
      }

      expect(durations).toEqual([6, 12, 24, 24]);
    });

    test('returns the details a run record keeps', async () => {
      const details = await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW);

      expect(details).toEqual({
        backoffReason: 'rate-limit',
        backoffScope: 'all',
        backoffMs: 6 * HOUR_MS,
        backoffUntil: new Date(NOW + 6 * HOUR_MS).toISOString(),
      });
    });
  });

  describe('clearIfUnchanged', () => {
    test('starts the next pause from 6 hours again', async () => {
      await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW);
      tabCountBackoff.clearIfUnchanged(tabCountBackoff.getRevision());

      const next = await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW);

      expect(next.backoffMs).toBe(6 * HOUR_MS);
    });

    test('keeps a pause that started after the given revision', async () => {
      const revision = tabCountBackoff.getRevision();
      await tabCountBackoff.start({ reason: 'rate-limit', bulk: false }, NOW);

      tabCountBackoff.clearIfUnchanged(revision);

      expect(await tabCountBackoff.remainingMs('bulk', NOW)).toBe(6 * HOUR_MS);
    });
  });

  describe('currentDetails', () => {
    test('is empty without a backoff', async () => {
      expect(await tabCountBackoff.currentDetails()).toEqual({});
    });

    test('describes the backoff for the run record', async () => {
      await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW);

      expect(await tabCountBackoff.currentDetails()).toEqual({
        backoffScope: 'all',
        backoffMs: 6 * HOUR_MS,
        backoffUntil: new Date(NOW + 6 * HOUR_MS).toISOString(),
      });
    });

    test('keeps describing an expired backoff until it is cleared', async () => {
      await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW - DAY_MS);

      expect((await tabCountBackoff.currentDetails()).backoffMs).toBe(6 * HOUR_MS);
    });
  });

  describe('run history', () => {
    const throttledRun = {
      outcome: 'throttled',
      details: { backoffUntil: new Date(NOW + 2 * HOUR_MS).toISOString(), backoffScope: 'all', backoffMs: 6 * HOUR_MS },
    };

    test('restores the pause the last throttled run recorded', async () => {
      tabCountBackoff.useRunHistory(historyWith(throttledRun), TASK_KEY);

      expect(await tabCountBackoff.remainingMs('on-demand', NOW)).toBe(2 * HOUR_MS);
    });

    test('reads the latest run that actually ran', async () => {
      const runHistory = historyWith(null);
      tabCountBackoff.useRunHistory(runHistory, TASK_KEY);

      await tabCountBackoff.remainingMs('bulk', NOW);

      expect(runHistory.getLatestRun).toHaveBeenCalledWith(TASK_KEY, { statuses: ['success', 'error'] });
    });

    test('restores a backoff an empty run carried forward', async () => {
      tabCountBackoff.useRunHistory(historyWith({ ...throttledRun, outcome: 'completed' }), TASK_KEY);

      expect(await tabCountBackoff.remainingMs('bulk', NOW)).toBe(2 * HOUR_MS);
    });

    test('does not pause when the latest run carries no backoff', async () => {
      tabCountBackoff.useRunHistory(historyWith({ outcome: 'completed', details: { refreshed: 3 } }), TASK_KEY);

      expect(await tabCountBackoff.remainingMs('bulk', NOW)).toBe(0);
    });

    test('keeps doubling after a restart when an empty run followed the throttle', async () => {
      const expired = { ...throttledRun.details, backoffUntil: new Date(NOW - HOUR_MS).toISOString() };
      tabCountBackoff.useRunHistory(historyWith({ outcome: 'completed', details: { refreshed: 0, ...expired } }), TASK_KEY);

      const next = await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW);

      expect(next.backoffMs).toBe(12 * HOUR_MS);
    });

    test('doubles from the restored pause', async () => {
      tabCountBackoff.useRunHistory(historyWith(throttledRun), TASK_KEY);

      const next = await tabCountBackoff.start({ reason: 'rate-limit', bulk: true }, NOW);

      expect(next.backoffMs).toBe(12 * HOUR_MS);
    });

    test('ignores a throttled run with unreadable details', async () => {
      tabCountBackoff.useRunHistory(historyWith({ outcome: 'throttled', details: { backoffUntil: 'soon' } }), TASK_KEY);

      expect(await tabCountBackoff.remainingMs('bulk', NOW)).toBe(0);
    });
  });
});
