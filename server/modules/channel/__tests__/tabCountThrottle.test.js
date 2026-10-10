/* eslint-env jest */

jest.mock('../../configModule', () => ({ getCookiesPath: jest.fn(() => null) }));

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const NOW = Date.parse('2026-09-27T12:00:00.000Z');
const TASK_KEY = 'channelVideoCountsFrequency';

describe('tabCountThrottle', () => {
  let tabCountThrottle;
  let configModule;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    configModule = require('../../configModule');
    tabCountThrottle = require('../tabCountThrottle');
  });

  const historyWith = (run) => ({ getLatestRun: jest.fn().mockResolvedValue(run) });

  describe('remainingMs', () => {
    test('is 0 before YouTube pushed back', async () => {
      expect(await tabCountThrottle.remainingMs('bulk', NOW)).toBe(0);
    });

    test('is 0 once the backoff has passed', async () => {
      await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);

      expect(await tabCountThrottle.remainingMs('bulk', NOW + 6 * HOUR_MS)).toBe(0);
    });
  });

  describe('start', () => {
    test('pauses every refresh for 6 hours after a rate limit', async () => {
      await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);

      expect(await tabCountThrottle.remainingMs('on-demand', NOW)).toBe(6 * HOUR_MS);
    });

    test('pauses only bulk refreshes after a bot check on a lookup without cookies when cookies are configured', async () => {
      configModule.getCookiesPath.mockReturnValue('/config/cookies.user.txt');
      await tabCountThrottle.start({ reason: 'bot-check', sentCookies: false }, NOW);

      expect([
        await tabCountThrottle.remainingMs('bulk', NOW),
        await tabCountThrottle.remainingMs('on-demand', NOW),
      ]).toEqual([6 * HOUR_MS, 0]);
    });

    test('pauses every refresh after a bot check when no cookies are configured', async () => {
      await tabCountThrottle.start({ reason: 'bot-check', sentCookies: false }, NOW);

      expect(await tabCountThrottle.remainingMs('on-demand', NOW)).toBe(6 * HOUR_MS);
    });

    test('pauses every refresh after a bot check on a lookup that sent cookies', async () => {
      configModule.getCookiesPath.mockReturnValue('/config/cookies.user.txt');
      await tabCountThrottle.start({ reason: 'bot-check', sentCookies: true }, NOW);

      expect(await tabCountThrottle.remainingMs('on-demand', NOW)).toBe(6 * HOUR_MS);
    });

    test('keeps pausing every refresh when a bot check without cookies follows a pause for all refreshes', async () => {
      configModule.getCookiesPath.mockReturnValue('/config/cookies.user.txt');
      await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: true }, NOW);
      await tabCountThrottle.start({ reason: 'bot-check', sentCookies: false }, NOW + HOUR_MS);

      expect(await tabCountThrottle.remainingMs('on-demand', NOW + HOUR_MS)).toBe(12 * HOUR_MS);
    });

    test('doubles the pause on consecutive throttles up to 24 hours', async () => {
      const durations = [];
      for (let i = 0; i < 4; i += 1) {
        durations.push((await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW)).backoffMs / HOUR_MS);
      }

      expect(durations).toEqual([6, 12, 24, 24]);
    });

    test('returns the details a run record keeps', async () => {
      const details = await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);

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
      await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);
      tabCountThrottle.clearIfUnchanged(tabCountThrottle.getRevision());

      const next = await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);

      expect(next.backoffMs).toBe(6 * HOUR_MS);
    });

    test('keeps a pause that started after the given revision', async () => {
      const revision = tabCountThrottle.getRevision();
      await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: true }, NOW);

      tabCountThrottle.clearIfUnchanged(revision);

      expect(await tabCountThrottle.remainingMs('bulk', NOW)).toBe(6 * HOUR_MS);
    });
  });

  describe('currentDetails', () => {
    test('is empty without a backoff', async () => {
      expect(await tabCountThrottle.currentDetails(NOW)).toEqual({});
    });

    test('describes the backoff for the run record', async () => {
      await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);

      expect(await tabCountThrottle.currentDetails(NOW)).toEqual({
        backoffScope: 'all',
        backoffMs: 6 * HOUR_MS,
        backoffUntil: new Date(NOW + 6 * HOUR_MS).toISOString(),
      });
    });

    test('keeps describing an expired backoff until it is cleared', async () => {
      await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW - DAY_MS);

      expect((await tabCountThrottle.currentDetails(NOW)).backoffMs).toBe(6 * HOUR_MS);
    });
  });

  describe('run history', () => {
    const throttledRun = {
      outcome: 'throttled',
      details: { backoffUntil: new Date(NOW + 2 * HOUR_MS).toISOString(), backoffScope: 'all', backoffMs: 6 * HOUR_MS },
    };

    test('restores the pause the last throttled run recorded', async () => {
      tabCountThrottle.useRunHistory(historyWith(throttledRun), TASK_KEY);

      expect(await tabCountThrottle.remainingMs('on-demand', NOW)).toBe(2 * HOUR_MS);
    });

    test('reads the latest run that actually ran', async () => {
      const runHistory = historyWith(null);
      tabCountThrottle.useRunHistory(runHistory, TASK_KEY);

      await tabCountThrottle.remainingMs('bulk', NOW);

      expect(runHistory.getLatestRun).toHaveBeenCalledWith(TASK_KEY, { statuses: ['success', 'error'] });
    });

    test('restores a backoff an empty run carried forward', async () => {
      tabCountThrottle.useRunHistory(historyWith({ ...throttledRun, outcome: 'completed' }), TASK_KEY);

      expect(await tabCountThrottle.remainingMs('bulk', NOW)).toBe(2 * HOUR_MS);
    });

    test('does not pause when the latest run carries no backoff', async () => {
      tabCountThrottle.useRunHistory(historyWith({ outcome: 'completed', details: { refreshed: 3 } }), TASK_KEY);

      expect(await tabCountThrottle.remainingMs('bulk', NOW)).toBe(0);
    });

    test('keeps doubling after a restart when an empty run followed the throttle', async () => {
      const expired = { ...throttledRun.details, backoffUntil: new Date(NOW - HOUR_MS).toISOString() };
      tabCountThrottle.useRunHistory(historyWith({ outcome: 'completed', details: { refreshed: 0, ...expired } }), TASK_KEY);

      const next = await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);

      expect(next.backoffMs).toBe(12 * HOUR_MS);
    });

    test('doubles from the restored pause', async () => {
      tabCountThrottle.useRunHistory(historyWith(throttledRun), TASK_KEY);

      const next = await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);

      expect(next.backoffMs).toBe(12 * HOUR_MS);
    });

    test('ignores a throttled run with unreadable details', async () => {
      tabCountThrottle.useRunHistory(historyWith({ outcome: 'throttled', details: { backoffUntil: 'soon' } }), TASK_KEY);

      expect(await tabCountThrottle.remainingMs('bulk', NOW)).toBe(0);
    });
  });
  describe('decay', () => {
    test('starts from 6 hours again once a pause ended more than 3 days ago', async () => {
      await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW - 4 * DAY_MS);

      const next = await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);

      expect(next.backoffMs).toBe(6 * HOUR_MS);
    });

    test('stops recording a pause that ended more than 3 days ago', async () => {
      await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW - 4 * DAY_MS);

      expect(await tabCountThrottle.currentDetails(NOW)).toEqual({});
    });

    test('does not restore a pause that ended more than 3 days ago', async () => {
      const staleRun = {
        outcome: 'throttled',
        details: { backoffUntil: new Date(NOW - 4 * DAY_MS).toISOString(), backoffScope: 'all', backoffMs: 12 * HOUR_MS },
      };
      tabCountThrottle.useRunHistory(historyWith(staleRun), TASK_KEY);

      const next = await tabCountThrottle.start({ reason: 'rate-limit', sentCookies: false }, NOW);

      expect(next.backoffMs).toBe(6 * HOUR_MS);
    });
  });

  describe('cookie mode', () => {
    const cookielessBotCheck = { sentCookies: false, counted: false, botCheck: true };

    beforeEach(() => {
      configModule.getCookiesPath.mockReturnValue('/config/cookies.user.txt');
    });

    test('bulk runs start without cookies', async () => {
      expect(await tabCountThrottle.bulkUsesCookies(NOW)).toBe(false);
    });

    test('keeps bulk runs without cookies after one bot check', async () => {
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);

      expect(await tabCountThrottle.bulkUsesCookies(NOW)).toBe(false);
    });

    test('switches bulk runs to cookies after two bot checks in a row', async () => {
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      const second = tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);

      expect([second.switchedToCookies, await tabCountThrottle.bulkUsesCookies(NOW)]).toEqual([true, true]);
    });

    test('resets the count after a run that counted something', async () => {
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      tabCountThrottle.recordBulkRun({ sentCookies: false, counted: true, botCheck: true }, NOW);
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);

      expect(await tabCountThrottle.bulkUsesCookies(NOW)).toBe(false);
    });

    test('only counts bot checks in back-to-back runs', async () => {
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      tabCountThrottle.recordBulkRun({ sentCookies: false, counted: false, botCheck: false }, NOW);
      const third = tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);

      expect(third.switchedToCookies).toBe(false);
    });

    test('does not count a bot check when no cookies are configured', async () => {
      configModule.getCookiesPath.mockReturnValue(null);
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      configModule.getCookiesPath.mockReturnValue('/config/cookies.user.txt');

      expect(await tabCountThrottle.bulkUsesCookies(NOW)).toBe(false);
    });

    test('survives clearing the pause', async () => {
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      await tabCountThrottle.start({ reason: 'bot-check', sentCookies: false }, NOW);

      tabCountThrottle.clearIfUnchanged(tabCountThrottle.getRevision());

      expect(await tabCountThrottle.bulkUsesCookies(NOW)).toBe(true);
    });

    test('survives the pause decaying', async () => {
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      await tabCountThrottle.start({ reason: 'bot-check', sentCookies: false }, NOW);

      expect(await tabCountThrottle.bulkUsesCookies(NOW + 10 * DAY_MS)).toBe(true);
    });

    test('tries without cookies again 30 days after the switch', async () => {
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);

      expect(await tabCountThrottle.bulkUsesCookies(NOW + 30 * DAY_MS)).toBe(false);
    });

    test('pauses every refresh after a bot check on a bulk run that sent cookies', async () => {
      const details = await tabCountThrottle.start({ reason: 'bot-check', sentCookies: true }, NOW);

      expect(details.backoffScope).toBe('all');
    });

    test('records the switch and the bot check count', async () => {
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);
      const afterOne = await tabCountThrottle.currentDetails(NOW);
      tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);

      expect([afterOne, await tabCountThrottle.currentDetails(NOW)]).toEqual([
        { cookielessBotChecks: 1 },
        { bulkCookiesSince: new Date(NOW).toISOString() },
      ]);
    });

    test('restores the switch after a restart', async () => {
      tabCountThrottle.useRunHistory(historyWith({
        outcome: 'completed',
        details: { refreshed: 4, bulkCookiesSince: new Date(NOW - DAY_MS).toISOString() },
      }), TASK_KEY);

      expect(await tabCountThrottle.bulkUsesCookies(NOW)).toBe(true);
    });

    test('restores the bot check count after a restart', async () => {
      tabCountThrottle.useRunHistory(historyWith({ outcome: 'throttled', details: { cookielessBotChecks: 1 } }), TASK_KEY);
      await tabCountThrottle.currentDetails(NOW);

      const next = tabCountThrottle.recordBulkRun(cookielessBotCheck, NOW);

      expect(next.switchedToCookies).toBe(true);
    });
  });
});
