import cronstrue from 'cronstrue';
import { describeSchedule, isSupportedCronSyntax, runsMoreThanHourly, SCHEDULE_FIELDS } from '../schedules';

describe('runsMoreThanHourly', () => {
  test.each([
    '*/15 * * * *',
    '*/30 * * * *',
    '*/20 * * * *',
    '0,30 * * * *',
    '0,15,30,45 * * * *',
    '10-40 * * * *',
    '0 */15 * * * *',
  ])('is true when the minute field matches more than one minute: %s', (expression) => {
    expect(runsMoreThanHourly(expression)).toBe(true);
  });

  // The punctuation alone says nothing: these all expand to a single minute
  // under node-cron's rules (a step keeps divisible values, ranges read low to high).
  test.each([
    '0 * * * *',
    '0 */4 * * *',
    '30 3 * * *',
    '0 0 * * 0',
    '0 20 2 * * *',
    '  0 2 * * *  ',
    '*/60 * * * *',
    '0-0 * * * *',
    '30-30 * * * *',
    '50-10/50 * * * *',
  ])('is false for a schedule that fires at most once an hour: %s', (expression) => {
    expect(runsMoreThanHourly(expression)).toBe(false);
  });

  test.each([
    '',
    'nonsense',
    'a * * * *',
    '*/0 * * * *',
    '*/x * * * *',
    '1-2-3 * * * *',
    '70 * * * *',
  ])('is false for a minute field the server would reject or that matches nothing: %s', (expression) => {
    expect(runsMoreThanHourly(expression)).toBe(false);
  });
});

describe('isSupportedCronSyntax', () => {
  test.each([
    '20 10-15 * * *',
    '0 15 9 * * 1-5',
    '0 2 * January,Sep MON-Fri',
    '0 2 * Dec-Jan Sunday',
    '0 2 * * 7',
    '0 2 * * 07',
    '45-15/15 * * * *',
    '  0 2 * * *  ',
  ])('accepts syntax node-cron runs: %s', (expression) => {
    expect(isSupportedCronSyntax(expression)).toBe(true);
  });

  // Everything here fails the server's validation, either its field rules or
  // node-cron's own parser (a step that leaves no value, like 10/11 or 1-9/10).
  test.each([
    '5 4-5 10/11 * *',
    '0 0 1-9/10 * *',
    '0 0 L * *',
    '0 0 * * 1#2',
    '0 0 15W * *',
    '@daily',
    '0 25 * * *',
    '0 2 0 * *',
    '0 2 * 13 *',
    '0 2 * * 8',
    '0 2 * *',
    '0 0 18 * * * extra',
    '1e1 * * * *',
    '0,,30 * * * *',
    '0-15-30 * * * *',
    '*/0 * * * *',
    '*/15/2 * * * *',
    '0 2 * Januaryfoo *',
    '0 0 * * 7-',
    '0 2 * * */7',
    // The server checks the raw weekday token before node-cron rewrites its 7.
    '0 2 * * 70',
    '0 2 * * 71',
    '',
    'nonsense',
  ])('rejects syntax the server would reject: %s', (expression) => {
    expect(isSupportedCronSyntax(expression)).toBe(false);
  });
});

describe('describeSchedule', () => {
  test('names a daily time', () => {
    expect(describeSchedule('0 2 * * *')).toBe('Daily at 02:00');
  });

  test('names a preset interval', () => {
    expect(describeSchedule('0 */6 * * *')).toBe('Every 6 hours');
  });

  test('describes a custom expression in words', () => {
    expect(describeSchedule('20 10-15 * * *')).toBe('At 20 minutes past the hour, between 10:00 and 15:59');
  });

  test('describes a six-field expression', () => {
    expect(describeSchedule('0 15 9 * * 1-5')).toBe('At 09:15, Monday through Friday');
  });

  test('reads day of month and weekday as both required, matching node-cron', () => {
    expect(describeSchedule('0 0 1 * 1')).toBe('At 00:00, on day 1 of the month, only on Monday');
  });

  test('describes full month and weekday names, which node-cron accepts', () => {
    expect(describeSchedule('0 2 * January,Sep MON-Fri')).toBe('At 02:00, Monday through Friday, only in January and September');
  });

  test('echoes an expression the server would reject instead of describing it', () => {
    expect(describeSchedule('5 4-5 10/11 * *')).toBe('Custom: 5 4-5 10/11 * *');
  });

  test('asks for a schedule when the expression is blank', () => {
    expect(describeSchedule('   ')).toBe('Schedule required');
  });

  // node-cron keeps the values divisible by a step, so a lone value with a
  // step is that value alone, not "every n from there".
  test('describes a value-with-step field as the single value node-cron runs', () => {
    expect(describeSchedule('0/15 * * * *')).toBe('Every hour');
  });

  test('lists the days node-cron runs for a day-of-month step', () => {
    expect(describeSchedule('0 0 1-31/10 * *')).toBe('At 00:00, on day 10, 20, and 30 of the month');
  });

  test('keeps a step whose values match standard cron', () => {
    expect(describeSchedule('*/15 * * * *')).toBe('Every 15 minutes');
  });

  test('canonicalizes a zero-padded weekday instead of letting cronstrue reject it', () => {
    expect(describeSchedule('0 2 * * 07')).toBe('At 02:00, only on Sunday');
  });

  test('canonicalizes a zero-padded day of month', () => {
    expect(describeSchedule('0 2 01 * *')).toBe('At 02:00, on day 1 of the month');
  });

  test('reads a reversed range low to high, as node-cron does', () => {
    expect(describeSchedule('0 0 5-1 * *')).toBe('At 00:00, between day 1 and 5 of the month');
  });

  test('reads weekday 7 as Sunday before the range, as node-cron does', () => {
    expect(describeSchedule('0 2 * * 5-7')).toBe('At 02:00, Sunday through Friday');
  });

  test('echoes the expression when cronstrue rejects it rather than throwing', () => {
    const spy = jest.spyOn(cronstrue, 'toString').mockImplementation(() => {
      throw new Error('unsupported');
    });
    try {
      expect(describeSchedule('20 10-15 * * *')).toBe('Custom: 20 10-15 * * *');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('frequentRunWarning', () => {
  test('automatic downloads carry no warning because sub-hourly runs are a normal choice', () => {
    const downloads = SCHEDULE_FIELDS.find((field) => field.key === 'channelDownloadFrequency');
    expect(downloads?.frequentRunWarning).toBeNull();
  });

  test('every other schedule explains why frequent runs are unwise', () => {
    const others = SCHEDULE_FIELDS.filter((field) => field.key !== 'channelDownloadFrequency');
    expect(others.every((field) => typeof field.frequentRunWarning === 'string' && field.frequentRunWarning.length > 0)).toBe(true);
  });
});
