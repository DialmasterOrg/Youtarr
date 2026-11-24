const logger = require('../logger');
const cookieTest = require('./cookieTest');
const membersAccess = require('./membersAccess');
const notificationModule = require('./notificationModule');
const scheduledTaskManager = require('./scheduledTaskManager');
const { getExternalCookiesPath } = require('./externalCookies');
const { ERROR_CODES } = require('./subscriptionImport/errorClassifier');

const TASK_KEY = 'cookieCheckFrequency';
// One failed check can be a YouTube page change rather than the cookies.
const FAILED_CHECKS_BEFORE_NOTIFYING = 2;
// Enough of the cookie file's hash to tell files apart in the run history.
const FINGERPRINT_LENGTH = 16;
// Stands in for a configured file that cannot be read, so it is still
// notified about. It is a condition, not a file: see track().
const UNREADABLE_FILE = 'unreadable';
const DOWNLOAD_TRIGGER = 'download';

const REASON = Object.freeze({
  // YouTube no longer treats the cookies as a signed-in session.
  REJECTED: 'rejected',
  // yt-dlp cannot load the file, so runs go without cookies.
  UNUSABLE: 'unusable',
});

const NOTICE = Object.freeze({
  PENDING: 'pending',
  SENT: 'sent',
  ALREADY: 'already',
  UNDELIVERED: 'undelivered',
});

// Results that say nothing about the cookies: bot checks are sporadic and
// IP-based even with valid cookies.
const INCONCLUSIVE_CODES = new Set([ERROR_CODES.BOT_CHECK, ERROR_CODES.NETWORK, ERROR_CODES.TIMEOUT]);

const MESSAGES = {
  NO_COOKIE_FILE: 'No cookie file is active.',
  TEST_RUNNING: 'A cookie test was already running.',
  FILE_CHANGED: 'The cookie file changed during the check.',
  VALID: 'YouTube accepted the cookies as a signed-in session.',
  REJECTED: 'YouTube did not accept the cookies as a signed-in session.',
  UNUSABLE: 'The cookie file could not be used.',
  COULD_NOT_RUN: 'The cookie test could not run.',
  DOWNLOAD_REJECTED: 'A download reported that YouTube rejected the cookies.',
  NOTIFICATIONS_OFF: 'Notifications are turned off, so none was sent.',
};

const NOTICE_MESSAGES = {
  [NOTICE.PENDING]: 'A notification is sent if the next check agrees.',
  [NOTICE.SENT]: 'A notification was sent.',
  [NOTICE.ALREADY]: 'You were already notified about this cookie file.',
  [NOTICE.UNDELIVERED]: 'The notification could not be delivered; the next check tries again.',
};

function fingerprint(cookieKey) {
  return cookieKey.slice(0, FINGERPRINT_LENGTH);
}

function failureReason(code) {
  if (code === ERROR_CODES.EXPIRED_COOKIES) return REASON.REJECTED;
  if (code === cookieTest.INVALID_COOKIE_FILE) return REASON.UNUSABLE;
  return null;
}

function asFile(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function describeNotice(notice) {
  const awaitingDelivery = notice === NOTICE.PENDING || notice === NOTICE.UNDELIVERED;
  if (awaitingDelivery && !notificationModule.isConfigured()) return MESSAGES.NOTIFICATIONS_OFF;
  return NOTICE_MESSAGES[notice];
}

/**
 * Decides when the user is told that the YouTube cookies stopped working:
 * after two failed scheduled checks in a row, or as soon as a download run
 * reports that YouTube rejected them, and once per cookie file either way.
 *
 * The run history is the persistence layer: every run this module describes
 * carries currentDetails() in its details, and the latest run that has
 * details is read back after a restart. Two things keep that reading true:
 * - runScheduledCheck() never rejects, so no check is recorded without them;
 * - checks and download reports run one at a time (serialize), so the run
 *   that started last also holds the state that was written last.
 */
class CookieHealth {
  constructor() {
    this.state = { cookieFile: null, failedChecks: 0, notifiedCookieFile: null };
    this.lastOperation = Promise.resolve();
    this.runHistory = null;
    this.loading = null;
  }

  /**
   * @param {{ getLatestRun: Function, record: Function }} runHistory - scheduledTaskRuns
   */
  useRunHistory(runHistory) {
    this.runHistory = runHistory;
    this.loading = null;
  }

  // Runs one check or download report at a time, in arrival order. They wait
  // on YouTube and on notification services, and interleaved they overwrote
  // each other's state: a slow notification for a replaced cookie file undid
  // the mark of its replacement, and a download report made during a check
  // was recorded as newer than the result of that check.
  serialize(operation) {
    const result = this.lastOperation.then(operation);
    this.lastOperation = result.catch(() => {});
    return result;
  }

  /**
   * Runs the cookie test and turns its result into a scheduled run record.
   * @returns {Promise<{ status: string, outcome: string, message: string, details: Object }>}
   */
  runScheduledCheck() {
    return this.serialize(async () => {
      try {
        return await this.check();
      } catch (error) {
        if (cookieTest.isBusyError(error)) return this.skip(MESSAGES.TEST_RUNNING);
        logger.error({ err: error }, 'Cookie check could not run');
        return {
          status: 'error',
          outcome: 'failed',
          message: error.message || MESSAGES.COULD_NOT_RUN,
          details: this.currentDetails(),
        };
      }
    });
  }

  async check() {
    await this.load();
    const file = this.currentFile();
    if (!file) return this.skip(MESSAGES.NO_COOKIE_FILE);
    this.track(file);

    const result = await cookieTest.run();
    // The result describes the file that was tested, not its replacement.
    if (this.currentFile() !== file) return this.skip(MESSAGES.FILE_CHANGED);
    if (!result.ok && INCONCLUSIVE_CODES.has(result.code)) return this.skip(result.error, 'inconclusive');

    if (result.ok) {
      this.state.failedChecks = 0;
      return { status: 'success', outcome: 'valid', message: MESSAGES.VALID, details: this.currentDetails() };
    }

    const reason = failureReason(result.code);
    // yt-dlp could not finish the test, which is not a verdict on the cookies.
    if (!reason) {
      return { status: 'error', outcome: 'failed', message: result.error, details: this.currentDetails() };
    }

    this.state.failedChecks += 1;
    const unusable = reason === REASON.UNUSABLE;
    const notice = this.state.failedChecks >= FAILED_CHECKS_BEFORE_NOTIFYING
      ? await this.notify(file, { reason, detail: unusable ? result.error || null : null })
      : this.pendingNotice(file);
    const base = unusable ? result.error || MESSAGES.UNUSABLE : MESSAGES.REJECTED;
    return {
      status: 'error',
      outcome: reason,
      message: `${base} ${describeNotice(notice)}`,
      details: this.currentDetails(),
    };
  }

  /**
   * A download run that passed the cookies saw yt-dlp's "cookies are no
   * longer valid" warning. Never rejects: it runs beside a download's
   * bookkeeping.
   * @param {string|null} cookieKey - the key of the cookies the run was
   *   given (ytdlpProcess's child.cookieKey); a run can outlive that file
   * @returns {Promise<void>}
   */
  async reportDownloadRejection(cookieKey) {
    if (!cookieKey) return;
    await this.serialize(async () => {
      try {
        await this.load();
        const file = fingerprint(cookieKey);
        // The warning is about the run's cookies, not ones uploaded since.
        // Compared only now, after every wait, so the answer is current.
        if (this.currentFile() !== file) return;
        this.track(file);
        // A rejection yt-dlp spelled out counts as a failed check, so the next
        // failing check notifies even when this notification cannot be delivered.
        const firstFailure = this.state.failedChecks === 0;
        if (firstFailure) this.state.failedChecks = 1;

        const notice = await this.notify(file, { reason: REASON.REJECTED, detail: null });
        // Otherwise nothing changed: every run with these cookies reports them.
        if (notice !== NOTICE.SENT && !firstFailure) return;
        await this.recordDownloadReport(notice);
      } catch (err) {
        logger.warn({ err }, 'Could not report cookies rejected by a download');
      }
    });
  }

  async recordDownloadReport(notice) {
    if (!this.runHistory) return;
    const now = new Date();
    await this.runHistory.record({
      taskKey: TASK_KEY,
      trigger: DOWNLOAD_TRIGGER,
      startedAt: now,
      finishedAt: now,
      status: 'error',
      outcome: REASON.REJECTED,
      message: `${MESSAGES.DOWNLOAD_REJECTED} ${describeNotice(notice)}`,
      details: this.currentDetails(),
    });
    // The write lands after the download's own broadcasts.
    scheduledTaskManager.notifyStatusChanged(TASK_KEY);
  }

  // A skipped run still records the state: following the cookie file can
  // change it (see track) whatever the test went on to say.
  skip(message, outcome = 'skipped') {
    return { status: 'skipped', outcome, message, details: this.currentDetails() };
  }

  // Identifies the active cookie file; null when none is configured.
  currentFile() {
    const { cookiesConfigured, cookieKey } = membersAccess.getContext();
    if (!cookiesConfigured) return null;
    return cookieKey ? fingerprint(cookieKey) : UNREADABLE_FILE;
  }

  // Follows the cookie file now in use: a replaced file starts its own
  // streak, and a readable file ends an "unreadable" notification, so the
  // file going missing again is a new incident worth another notification.
  track(file) {
    if (file !== UNREADABLE_FILE && this.state.notifiedCookieFile === UNREADABLE_FILE) {
      this.state.notifiedCookieFile = null;
    }
    if (this.state.cookieFile === file) return;
    this.state.cookieFile = file;
    this.state.failedChecks = 0;
  }

  pendingNotice(file) {
    return this.state.notifiedCookieFile === file ? NOTICE.ALREADY : NOTICE.PENDING;
  }

  // Sends the notification unless this file already had one. A file counts
  // as notified only once a notification service accepted the message, so
  // notifications that are off or failing get another try later.
  async notify(file, { reason, detail }) {
    if (this.state.notifiedCookieFile === file) return NOTICE.ALREADY;
    try {
      const delivered = await notificationModule.sendCookiesInvalidNotification({
        reason,
        external: Boolean(getExternalCookiesPath()),
        detail,
      });
      if (!delivered) return NOTICE.UNDELIVERED;
      this.state.notifiedCookieFile = file;
      logger.info({ reason }, 'Notified that the YouTube cookies stopped working');
      return NOTICE.SENT;
    } catch (err) {
      logger.error({ err }, 'Failed to send the cookies notification');
      return NOTICE.UNDELIVERED;
    }
  }

  // The state a run records in its details. Never the full cookie hash:
  // run details are served to the Scheduling page.
  currentDetails() {
    return { ...this.state };
  }

  async load() {
    if (!this.loading) this.loading = this.readLatestRun();
    return this.loading;
  }

  async readLatestRun() {
    if (!this.runHistory) return;
    // Only a run that has details: one recorded without them (a skip the
    // scheduler wrote itself, say) must not hide the state before it.
    const run = await this.runHistory.getLatestRun(TASK_KEY, { withDetails: true });
    const details = run && run.details;
    // State from operations that ran before the history was attached is newer.
    if (!details || this.state.cookieFile !== null || this.state.notifiedCookieFile !== null) return;

    const cookieFile = asFile(details.cookieFile);
    const failedChecks = Number.isInteger(details.failedChecks) && details.failedChecks > 0 ? details.failedChecks : 0;
    this.state = {
      cookieFile,
      failedChecks: cookieFile ? failedChecks : 0,
      notifiedCookieFile: asFile(details.notifiedCookieFile),
    };
  }
}

module.exports = new CookieHealth();
