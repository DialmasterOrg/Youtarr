/* eslint-env jest */
const {
  getScheduleError,
  getNextRun,
  isValidSchedule,
  violatesMinimumInterval,
  normalizeToMinimumInterval,
  MIN_SCHEDULE_INTERVAL_MINUTES,
} = require('../scheduleConfig');

describe('getScheduleError', () => {
  test.each([
    '*/15 * * * *',
    '0 * * * *',
    '0,20,40 * * * *',
    '5,55 1 * * *',
    '0 23,0 * * *',
    '0 15 9 * * 1-5',
    '  0 2 * * *  ',
    // Sundays only: 00:05, 00:55, 23:05, 23:55, never adjacent across midnight.
    '5,55 0,23 * * 0',
    '0 2 * January,Sep MON-Fri',
    '0 2 * Dec-Jan Sunday',
    '0 2 * * 7',
    '45-15/15 * * * *',
    '00 */4 * * *',
    '*/60 * * * *',
  ])('accepts %p', (value) => {
    expect(getScheduleError(value)).toBeNull();
  });

  test.each([
    '* * * * *',
    '*/10 * * * *',
    '0-59/5 * * * *',
    '0,50 * * * *',
    '50,0 23,0 * * *',
    // Sunday 23:50 is followed by Monday 00:00.
    '50,0 23,0 * * 0,1',
    // Same-day adjacent hours don't depend on the calendar.
    '5,55 10,11 * * 0',
    '50-10 * * * *',
    '*/30 * * * * *',
    '0-30 15 9 * * *',
  ])('rejects %p as too frequent', (value) => {
    expect(getScheduleError(value)).toMatch(
      new RegExp(`${MIN_SCHEDULE_INTERVAL_MINUTES} minutes`)
    );
  });

  test.each([
    'invalid', '', null, 123, '0 25 * * *', '0 0 18 * * * extra',
    '1e1 * * * *', '1.5 * * * *', '0x10 * * * *',
    '0foo * * * *', '0,,30 * * * *', '0-15-30 * * * *',
    '*/0 * * * *', '*/1e1 * * * *', '*/15/2 * * * *',
    '0 2 0 * *', '0 2 * 13 *', '0 2 * * 8',
    '0 2 * Januaryfoo *',
  ])(
    'rejects %p as invalid syntax', (value) => {
      expect(getScheduleError(value)).toMatch(/valid cron expression/);
    }
  );
});

describe('unsafe numeric schedule input', () => {
  test('rejects dangerous values throughout validation, prediction and startup normalization', () => {
    const { execFileSync } = require('child_process');
    const path = require('path');
    const expressions = ['1e309', '1e99', '0-99999999999999999999999'].flatMap((token) => (
      Array.from({ length: 6 }, (_, index) => {
        const fields = ['0', '0', '2', '*', '*', '*'];
        fields[index] = token;
        return fields.join(' ');
      })
    ));
    expressions.push('1e309 * * * *', '1e99 * * * *');
    // A synchronous infinite loop can't be stopped by Jest's test timeout.
    // Keep the real parser in a child process with an OS-enforced timeout.
    const output = execFileSync(process.execPath, [
      path.join(__dirname, 'fixtures', 'unsafeSchedules.js'),
      JSON.stringify(expressions),
    ], { encoding: 'utf8', timeout: 2000, killSignal: 'SIGKILL' });

    expect(JSON.parse(output)).toEqual(expressions.map((expression) => ({
      error: 'enter a valid cron expression.',
      valid: false,
      next: null,
      violatesMinimum: false,
      normalized: expression,
    })));
  });
});

describe('getNextRun', () => {
  // Sunday 20 September 2026, 10:30 local time.
  const from = new Date(2026, 8, 20, 10, 30, 0);

  test('returns the next daily occurrence after the given time', () => {
    expect(getNextRun('0 2 * * *', from)).toEqual(new Date(2026, 8, 21, 2, 0, 0));
  });

  test('returns a later occurrence on the same day when one remains', () => {
    expect(getNextRun('0 18 * * *', from)).toEqual(new Date(2026, 8, 20, 18, 0, 0));
  });

  test('aligns interval presets to the clock', () => {
    expect(getNextRun('0 */4 * * *', from)).toEqual(new Date(2026, 8, 20, 12, 0, 0));
  });

  test('honors day-of-week restrictions', () => {
    expect(getNextRun('15 9 * * 1-5', from)).toEqual(new Date(2026, 8, 21, 9, 15, 0));
  });

  test('uses a fixed seconds field', () => {
    expect(getNextRun('30 0 18 * * *', from)).toEqual(new Date(2026, 8, 20, 18, 0, 30));
  });

  test('preserves node-cron step semantics within a range', () => {
    expect(getNextRun('5-55/15 * * * *', from)).toEqual(new Date(2026, 8, 20, 10, 45, 0));
  });

  test('honors named months and weekdays', () => {
    expect(getNextRun('0 2 * September Monday', from)).toEqual(new Date(2026, 8, 21, 2, 0, 0));
  });

  test('excludes an occurrence at exactly the given time', () => {
    const exact = new Date(2026, 8, 20, 18, 0, 0);
    expect(getNextRun('0 18 * * *', exact)).toEqual(new Date(2026, 8, 21, 18, 0, 0));
  });

  test('returns null when no occurrence exists within a year', () => {
    expect(getNextRun('0 0 31 2 *', from)).toBeNull();
  });

  test('returns null for an expression that cannot be scheduled', () => {
    expect(getNextRun('*/5 * * * *', from)).toBeNull();
  });

});

describe('getNextRun across clock changes', () => {
  const { execFileSync } = require('child_process');
  const path = require('path');
  const fixture = path.join(__dirname, 'fixtures', 'nextRunInZone.js');

  // TZ has to be in the environment before Node starts: Jest hands tests a
  // copied process.env, so setting it inside a test leaves Date on the host zone.
  const runInZone = (timeZone, expression, local) => JSON.parse(execFileSync(
    process.execPath,
    [fixture, expression, ...local.map(String)],
    { env: { ...process.env, TZ: timeZone }, encoding: 'utf8' }
  ));

  test.each([
    ['America/Los_Angeles falls back by an hour', 'America/Los_Angeles', [2026, 10, 1, 1, 50], 60],
    ['Australia/Lord_Howe falls back by thirty minutes', 'Australia/Lord_Howe', [2026, 3, 5, 1, 50], 30],
    ['America/Los_Angeles springs forward', 'America/Los_Angeles', [2026, 2, 8, 1, 50], -60],
  ])('never skips an occurrence when %s', (_name, timeZone, local, offsetShiftMinutes) => {
    const result = runInZone(timeZone, '*/15 * * * *', local);
    expect(result.timeZone).toBe(timeZone);
    // The offset change between start and the reference run proves the case
    // straddles the transition; under UTC this can't pass by accident.
    expect(result.expectedOffset - result.startOffset).toBe(offsetShiftMinutes);
    expect(Date.parse(result.expected) - Date.parse(result.start)).toBeLessThanOrEqual(15 * 60000);
    expect(result.next).toBe(result.expected);
  });
});

describe('violatesMinimumInterval', () => {
  test('is true for a valid expression below the floor', () => {
    expect(violatesMinimumInterval('*/5 * * * *')).toBe(true);
  });

  test('is false for a compliant expression', () => {
    expect(violatesMinimumInterval('0 2 * * *')).toBe(false);
  });

  test('is false for invalid syntax, which is a different problem', () => {
    expect(violatesMinimumInterval('invalid')).toBe(false);
  });
});

describe('normalizeToMinimumInterval', () => {
  test.each([
    ['*/5 * * * *', '*/15 * * * *'],
    ['* * * * *', '*/15 * * * *'],
    ['*/10 * * * *', '*/20 * * * *'],
    ['0,5 2 * * 0', '0 2 * * 0'],
    ['0,10,25 2 * * *', '0,25 2 * * *'],
    ['0,50 * * * *', '0 * * * *'],
    ['*/30 0 18 * * *', '0 0 18 * * *'],
  ])('thins %p to %p without widening its hours or days', (input, output) => {
    expect(normalizeToMinimumInterval(input)).toBe(output);
    expect(violatesMinimumInterval(output)).toBe(false);
  });

  test('leaves a compliant expression unchanged', () => {
    expect(normalizeToMinimumInterval('5,55 0,23 * * 0')).toBe('5,55 0,23 * * 0');
  });
});

describe('isValidSchedule', () => {
  test('accepts a schedule at the minimum interval', () => {
    expect(isValidSchedule('*/15 * * * *')).toBe(true);
  });

  test('rejects a schedule below the minimum interval', () => {
    expect(isValidSchedule('*/10 * * * *')).toBe(false);
  });
});
