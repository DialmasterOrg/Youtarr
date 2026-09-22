import { runsMoreThanHourly, SCHEDULE_FIELDS } from '../schedules';

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
