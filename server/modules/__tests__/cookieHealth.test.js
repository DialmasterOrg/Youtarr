/* eslint-env jest */

jest.mock('../../logger');
jest.mock('../membersAccess');
jest.mock('../cookieTest', () => ({
  run: jest.fn(),
  isBusyError: jest.fn((error) => error?.code === 'COOKIE_TEST_IN_PROGRESS'),
  INVALID_COOKIE_FILE: 'INVALID_COOKIE_FILE',
}));
jest.mock('../notificationModule', () => ({
  isConfigured: jest.fn(() => true),
  sendCookiesInvalidNotification: jest.fn(),
}));
jest.mock('../externalCookies', () => ({ getExternalCookiesPath: jest.fn(() => null) }));
jest.mock('../scheduledTaskManager', () => ({ notifyStatusChanged: jest.fn() }));

const FILE_A = 'a'.repeat(64);
const FILE_B = 'b'.repeat(64);
const TASK_KEY = 'cookieCheckFrequency';

const PASSED = { ok: true, message: 'YouTube accepted these cookies as a signed-in session.' };
const failed = (code, error = `${code} happened`) => ({ ok: false, code, error });
const REJECTED = failed('EXPIRED_COOKIES');

describe('cookieHealth', () => {
  let cookieHealth;
  let cookieTest;
  let membersAccess;
  let notificationModule;
  let externalCookies;

  const useCookieFile = (cookieKey) => {
    membersAccess.getContext.mockReturnValue({ cookiesConfigured: true, cookieKey, loginCookiesLive: true });
  };

  // Runs one scheduled check per given cookie test result, in order.
  const runChecks = async (...results) => {
    const records = [];
    for (const result of results) {
      cookieTest.run.mockResolvedValueOnce(result);
      records.push(await cookieHealth.runScheduledCheck());
    }
    return records;
  };

  const historyWith = (run) => ({
    getLatestRun: jest.fn().mockResolvedValue(run),
    record: jest.fn().mockResolvedValue(undefined),
  });

  // Lets work that is waiting on already-settled promises run.
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  // Makes the next notification wait until the returned function is called
  // with whether a service accepted it.
  const holdNextNotification = () => {
    let finish;
    notificationModule.sendCookiesInvalidNotification.mockImplementationOnce(
      () => new Promise((resolve) => { finish = resolve; })
    );
    return (delivered) => finish(delivered);
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    cookieTest = require('../cookieTest');
    membersAccess = require('../membersAccess');
    notificationModule = require('../notificationModule');
    externalCookies = require('../externalCookies');
    notificationModule.isConfigured.mockReturnValue(true);
    notificationModule.sendCookiesInvalidNotification.mockResolvedValue(true);
    externalCookies.getExternalCookiesPath.mockReturnValue(null);
    useCookieFile(FILE_A);
    cookieHealth = require('../cookieHealth');
  });

  describe('runScheduledCheck', () => {
    test('records a passing check as a success', async () => {
      const [record] = await runChecks(PASSED);

      expect(record).toMatchObject({ status: 'success', outcome: 'valid' });
    });

    test('records a rejected check as an error without notifying the first time', async () => {
      const [record] = await runChecks(REJECTED);

      expect(record).toMatchObject({ status: 'error', outcome: 'rejected' });
      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test('notifies once the cookies are rejected twice in a row', async () => {
      await runChecks(REJECTED, REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledWith({
        reason: 'rejected',
        external: false,
        detail: null,
      });
    });

    test('does not notify again for the same cookie file', async () => {
      await runChecks(REJECTED, REJECTED, REJECTED, REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('does not notify when a passing check separates two rejections', async () => {
      await runChecks(REJECTED, PASSED, REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test.each(['BOT_CHECK', 'NETWORK', 'TIMEOUT'])(
      'records a %s result as skipped and never notifies for it',
      async (code) => {
        const records = await runChecks(failed(code), failed(code), failed(code));

        expect(records.map((record) => record.status)).toEqual(['skipped', 'skipped', 'skipped']);
        expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
      }
    );

    test.each(['BOT_CHECK', 'NETWORK', 'TIMEOUT'])(
      'keeps the failure streak across a %s result',
      async (code) => {
        await runChecks(REJECTED, failed(code), REJECTED);

        expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
      }
    );

    test('records a test yt-dlp could not complete as an error that never notifies', async () => {
      const records = await runChecks(failed('UNKNOWN'), failed('UNKNOWN'));

      expect(records[1]).toMatchObject({ status: 'error', outcome: 'failed' });
      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test('counts an external cookie file yt-dlp cannot load like a rejection', async () => {
      externalCookies.getExternalCookiesPath.mockReturnValue('/cookies/youtube.txt');
      const unusable = failed('INVALID_COOKIE_FILE', 'External cookies: yt-dlp could not load the file.');

      const records = await runChecks(unusable, unusable);

      expect(records[1]).toMatchObject({ status: 'error', outcome: 'unusable' });
      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledWith({
        reason: 'unusable',
        external: true,
        detail: 'External cookies: yt-dlp could not load the file.',
      });
    });

    test('notifies for a cookie file that cannot be read at all', async () => {
      useCookieFile(null);
      const unusable = failed('INVALID_COOKIE_FILE', 'External cookies: the file could not be read.');

      await runChecks(unusable, unusable, unusable);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('notifies again after the cookie file is replaced and the new one is rejected twice', async () => {
      await runChecks(REJECTED, REJECTED);
      useCookieFile(FILE_B);
      await runChecks(REJECTED, REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(2);
    });

    test('starts the streak over when the cookie file is replaced', async () => {
      await runChecks(REJECTED);
      useCookieFile(FILE_B);
      await runChecks(REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test('tries the notification again on the next check when it could not be delivered', async () => {
      notificationModule.sendCookiesInvalidNotification.mockResolvedValueOnce(false);

      await runChecks(REJECTED, REJECTED, REJECTED, REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(2);
    });

    test('still records the check when sending the notification throws', async () => {
      notificationModule.sendCookiesInvalidNotification.mockRejectedValueOnce(new Error('apprise missing'));

      const records = await runChecks(REJECTED, REJECTED);

      expect(records[1]).toMatchObject({ status: 'error', outcome: 'rejected' });
    });

    test('skips without calling YouTube when no cookie file is active', async () => {
      membersAccess.getContext.mockReturnValue({ cookiesConfigured: false, cookieKey: null, loginCookiesLive: false });

      const record = await cookieHealth.runScheduledCheck();

      expect(record.status).toBe('skipped');
      expect(cookieTest.run).not.toHaveBeenCalled();
    });

    test('skips when a cookie test is already running', async () => {
      const busy = Object.assign(new Error('A cookie test is already running.'), { code: 'COOKIE_TEST_IN_PROGRESS' });
      cookieTest.run.mockRejectedValueOnce(busy);

      const record = await cookieHealth.runScheduledCheck();

      expect(record.status).toBe('skipped');
    });

    test('records a cookie test that could not run as an error that keeps the state', async () => {
      await runChecks(REJECTED);
      cookieTest.run.mockRejectedValueOnce(new Error('ENOENT'));

      const record = await cookieHealth.runScheduledCheck();

      expect(record).toMatchObject({
        status: 'error',
        outcome: 'failed',
        message: 'ENOENT',
        details: { cookieFile: 'aaaaaaaaaaaaaaaa', failedChecks: 1, notifiedCookieFile: null },
      });
    });

    test('does not count a cookie test that could not run toward the streak', async () => {
      await runChecks(REJECTED);
      cookieTest.run.mockRejectedValueOnce(new Error('ENOENT'));
      await cookieHealth.runScheduledCheck();

      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test('notifies again when the cookie file becomes unreadable a second time', async () => {
      const unusable = failed('INVALID_COOKIE_FILE', 'External cookies: the file could not be read.');
      useCookieFile(null);
      await runChecks(unusable, unusable);
      useCookieFile(FILE_A);
      await runChecks(PASSED);
      useCookieFile(null);

      await runChecks(unusable, unusable);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(2);
    });

    test('writes a readable file\'s recovery into a skipped run, so it survives a restart', async () => {
      const unusable = failed('INVALID_COOKIE_FILE', 'External cookies: the file could not be read.');
      useCookieFile(null);
      await runChecks(unusable, unusable);
      useCookieFile(FILE_A);

      const [record] = await runChecks(failed('BOT_CHECK'));

      expect(record).toMatchObject({
        status: 'skipped',
        details: { cookieFile: 'aaaaaaaaaaaaaaaa', failedChecks: 0, notifiedCookieFile: null },
      });
    });

    test('still notifies once per readable cookie file after it passed and failed again', async () => {
      await runChecks(REJECTED, REJECTED, PASSED, REJECTED, REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('does not judge a cookie file that was replaced while the check ran', async () => {
      await runChecks(REJECTED);
      cookieTest.run.mockImplementationOnce(async () => {
        useCookieFile(FILE_B);
        return REJECTED;
      });

      const record = await cookieHealth.runScheduledCheck();

      expect(record.status).toBe('skipped');
      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test('writes its state into the run details without the full cookie hash', async () => {
      const [record] = await runChecks(REJECTED);

      expect(record.details).toEqual({
        cookieFile: 'aaaaaaaaaaaaaaaa',
        failedChecks: 1,
        notifiedCookieFile: null,
      });
    });

    test('names the notified cookie file in the run details', async () => {
      const records = await runChecks(REJECTED, REJECTED);

      expect(records[1].details).toEqual({
        cookieFile: 'aaaaaaaaaaaaaaaa',
        failedChecks: 2,
        notifiedCookieFile: 'aaaaaaaaaaaaaaaa',
      });
    });
  });

  describe('state restored from the run history', () => {
    test('notifies on the first rejection after a restart when the last run had already failed once', async () => {
      const history = historyWith({
        status: 'error',
        details: { cookieFile: 'aaaaaaaaaaaaaaaa', failedChecks: 1, notifiedCookieFile: null },
      });
      cookieHealth.useRunHistory(history);

      await runChecks(REJECTED);

      expect(history.getLatestRun).toHaveBeenCalledWith(TASK_KEY, { withDetails: true });
      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('stays quiet after a restart for a cookie file that was already notified', async () => {
      cookieHealth.useRunHistory(historyWith({
        status: 'error',
        details: { cookieFile: 'aaaaaaaaaaaaaaaa', failedChecks: 2, notifiedCookieFile: 'aaaaaaaaaaaaaaaa' },
      }));

      await runChecks(REJECTED, REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test('ignores a recorded streak that belongs to another cookie file', async () => {
      cookieHealth.useRunHistory(historyWith({
        status: 'error',
        details: { cookieFile: 'bbbbbbbbbbbbbbbb', failedChecks: 1, notifiedCookieFile: null },
      }));

      await runChecks(REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test('starts clean when the recorded details are malformed', async () => {
      cookieHealth.useRunHistory(historyWith({
        status: 'error',
        details: { cookieFile: 42, failedChecks: 'many', notifiedCookieFile: {} },
      }));

      const [record] = await runChecks(REJECTED);

      expect(record.details).toEqual({ cookieFile: 'aaaaaaaaaaaaaaaa', failedChecks: 1, notifiedCookieFile: null });
    });
  });

  describe('reportDownloadRejection', () => {
    test('notifies at once, without waiting for a second failure', async () => {
      await cookieHealth.reportDownloadRejection(FILE_A);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledWith({
        reason: 'rejected',
        external: false,
        detail: null,
      });
    });

    test('notifies only once however many downloads report the same cookie file', async () => {
      await cookieHealth.reportDownloadRejection(FILE_A);
      await cookieHealth.reportDownloadRejection(FILE_A);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('sends one notification when two downloads report at the same moment', async () => {
      await Promise.all([cookieHealth.reportDownloadRejection(FILE_A), cookieHealth.reportDownloadRejection(FILE_A)]);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('keeps later scheduled checks from notifying about the same cookie file', async () => {
      await cookieHealth.reportDownloadRejection(FILE_A);
      await runChecks(REJECTED, REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('stays quiet for a cookie file the scheduled check already notified about', async () => {
      await runChecks(REJECTED, REJECTED);
      await cookieHealth.reportDownloadRejection(FILE_A);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('records the notification in the run history so it survives a restart', async () => {
      const history = historyWith(null);
      cookieHealth.useRunHistory(history);

      await cookieHealth.reportDownloadRejection(FILE_A);

      expect(history.record).toHaveBeenCalledWith(expect.objectContaining({
        taskKey: TASK_KEY,
        trigger: 'download',
        status: 'error',
        outcome: 'rejected',
        details: { cookieFile: 'aaaaaaaaaaaaaaaa', failedChecks: 1, notifiedCookieFile: 'aaaaaaaaaaaaaaaa' },
      }));
    });

    test('records a rejection whose notification could not be delivered, so it survives a restart', async () => {
      const history = historyWith(null);
      cookieHealth.useRunHistory(history);
      notificationModule.sendCookiesInvalidNotification.mockResolvedValueOnce(false);

      await cookieHealth.reportDownloadRejection(FILE_A);

      expect(history.record).toHaveBeenCalledWith(expect.objectContaining({
        trigger: 'download',
        status: 'error',
        outcome: 'rejected',
        details: { cookieFile: 'aaaaaaaaaaaaaaaa', failedChecks: 1, notifiedCookieFile: null },
      }));
    });

    test('records an undelivered rejection once, not for every download that reports it', async () => {
      const history = historyWith(null);
      cookieHealth.useRunHistory(history);
      notificationModule.sendCookiesInvalidNotification.mockResolvedValue(false);

      await cookieHealth.reportDownloadRejection(FILE_A);
      await cookieHealth.reportDownloadRejection(FILE_A);

      expect(history.record).toHaveBeenCalledTimes(1);
    });

    test('tries again at the next failing check when the notification could not be delivered', async () => {
      notificationModule.sendCookiesInvalidNotification.mockResolvedValueOnce(false);

      await cookieHealth.reportDownloadRejection(FILE_A);
      await runChecks(REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(2);
    });

    test('tells open Scheduling pages only once the report is in the run history', async () => {
      const { notifyStatusChanged } = require('../scheduledTaskManager');
      const history = historyWith(null);
      let finishWrite;
      history.record.mockImplementation(() => new Promise((resolve) => { finishWrite = resolve; }));
      cookieHealth.useRunHistory(history);

      const report = cookieHealth.reportDownloadRejection(FILE_A);
      await settle();
      const toldDuringWrite = notifyStatusChanged.mock.calls.length;
      finishWrite();
      await report;

      expect(toldDuringWrite).toBe(0);
      expect(notifyStatusChanged.mock.calls).toEqual([[TASK_KEY]]);
    });

    test('ignores a rejection of cookies that were replaced while the download ran', async () => {
      useCookieFile(FILE_B);

      await cookieHealth.reportDownloadRejection(FILE_A);

      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test('still notifies about the replacement cookies when they are rejected later', async () => {
      useCookieFile(FILE_B);
      await cookieHealth.reportDownloadRejection(FILE_A);

      await runChecks(REJECTED, REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('does nothing when the cookies the download started with are unknown', async () => {
      await cookieHealth.reportDownloadRejection(null);

      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    describe('when the cookies are replaced while a notification for the old ones is going out', () => {
      const reportBothFiles = async () => {
        const finishFirst = holdNextNotification();
        const first = cookieHealth.reportDownloadRejection(FILE_A);
        await settle();
        useCookieFile(FILE_B);
        const second = cookieHealth.reportDownloadRejection(FILE_B);
        await settle();
        finishFirst(true);
        await Promise.all([first, second]);
      };

      test('notifies about the new cookies as well', async () => {
        await reportBothFiles();

        expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(2);
      });

      test('keeps the new cookies marked as notified once the older notification finishes', async () => {
        await reportBothFiles();

        await cookieHealth.reportDownloadRejection(FILE_B);

        expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(2);
      });
    });

    test('ignores a rejection when the cookies are replaced while the saved state is being read', async () => {
      const history = historyWith(null);
      let finishRead;
      history.getLatestRun.mockImplementation(() => new Promise((resolve) => { finishRead = resolve; }));
      cookieHealth.useRunHistory(history);

      const report = cookieHealth.reportDownloadRejection(FILE_A);
      await settle();
      useCookieFile(FILE_B);
      finishRead(null);
      await report;

      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });
  });

  describe('a download that reports while a scheduled check is running', () => {
    // The check passes; the download's notification cannot be delivered.
    const reportDuringPassingCheck = async (history) => {
      cookieHealth.useRunHistory(history);
      notificationModule.sendCookiesInvalidNotification.mockResolvedValue(false);
      let finishProbe;
      cookieTest.run.mockImplementationOnce(() => new Promise((resolve) => { finishProbe = resolve; }));

      const check = cookieHealth.runScheduledCheck();
      await settle();
      const report = cookieHealth.reportDownloadRejection(FILE_A);
      await settle();
      finishProbe(PASSED);
      await Promise.all([check, report]);
    };

    // After a restart the state comes from the run that started last, which
    // is the download's: it has to hold what the two left behind together.
    test('records the state both left behind in the run a restart reads back', async () => {
      const history = historyWith(null);

      await reportDuringPassingCheck(history);

      const afterBoth = { cookieFile: 'aaaaaaaaaaaaaaaa', failedChecks: 1, notifiedCookieFile: null };
      expect(history.record.mock.calls.map(([run]) => run.details)).toEqual([afterBoth]);
      expect(cookieHealth.currentDetails()).toEqual(afterBoth);
    });

    test('counts the download\'s rejection after the check, so one more failed check notifies', async () => {
      await reportDuringPassingCheck(historyWith(null));
      notificationModule.sendCookiesInvalidNotification.mockClear();

      await runChecks(REJECTED);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('a check that overlaps a notification already going out', () => {
    // One rejection is on record, so the check below is the second in a row.
    const overlapCheckWithDownloadSend = async (delivered) => {
      await runChecks(REJECTED);
      const finishSend = holdNextNotification();
      const report = cookieHealth.reportDownloadRejection(FILE_A);
      await settle();

      cookieTest.run.mockResolvedValueOnce(REJECTED);
      const check = cookieHealth.runScheduledCheck();
      await settle();
      finishSend(delivered);
      await report;
      return check;
    };

    test('sends nothing more for the same cookie file', async () => {
      await overlapCheckWithDownloadSend(true);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(1);
    });

    test('records the cookie file as notified once that notification is delivered', async () => {
      const record = await overlapCheckWithDownloadSend(true);

      expect(record.details.notifiedCookieFile).toBe('aaaaaaaaaaaaaaaa');
    });

    test('sends its own notification when that one fails, instead of assuming it arrived', async () => {
      const record = await overlapCheckWithDownloadSend(false);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(2);
      expect(record.details.notifiedCookieFile).toBe('aaaaaaaaaaaaaaaa');
    });

    test('tries again on the next download when the notification could not be delivered', async () => {
      notificationModule.sendCookiesInvalidNotification.mockResolvedValueOnce(false);

      await cookieHealth.reportDownloadRejection(FILE_A);
      await cookieHealth.reportDownloadRejection(FILE_A);

      expect(notificationModule.sendCookiesInvalidNotification).toHaveBeenCalledTimes(2);
    });

    test('does nothing when the cookie file cannot be identified', async () => {
      useCookieFile(null);

      await cookieHealth.reportDownloadRejection(FILE_A);

      expect(notificationModule.sendCookiesInvalidNotification).not.toHaveBeenCalled();
    });

    test('never rejects, so a download is not failed by a notification problem', async () => {
      notificationModule.sendCookiesInvalidNotification.mockRejectedValueOnce(new Error('apprise missing'));

      await expect(cookieHealth.reportDownloadRejection(FILE_A)).resolves.toBeUndefined();
    });
  });
});
