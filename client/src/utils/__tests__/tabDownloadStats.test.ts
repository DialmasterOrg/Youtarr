import { describeTabCounts, describeTabStats, formatTabPercent, PUBLIC_ONLY_NOTE } from '../tabDownloadStats';
import { TabDownloadStats } from '../../types/Channel';

const stats = (overrides: Partial<TabDownloadStats> = {}): TabDownloadStats => ({
  total: 449,
  fetchedAt: '2026-09-25T04:45:00.000Z',
  downloaded: 120,
  ignored: 0,
  percent: 26,
  ...overrides,
});

describe('formatTabPercent', () => {
  test('formats the percent', () => {
    expect(formatTabPercent(stats())).toBe('26%');
  });

  test('returns null without a percent', () => {
    expect(formatTabPercent(stats({ total: null, percent: null }))).toBeNull();
  });

  test('returns null without stats', () => {
    expect(formatTabPercent(undefined)).toBeNull();
  });

  test('shows less than 1% when some videos are downloaded', () => {
    expect(formatTabPercent(stats({ total: 6070, downloaded: 9, percent: 0 }))).toBe('<1%');
  });

  test('shows 0% when nothing is downloaded', () => {
    expect(formatTabPercent(stats({ downloaded: 0, percent: 0 }))).toBe('0%');
  });
});

describe('describeTabCounts', () => {
  test('includes the loaded count when known', () => {
    expect(describeTabCounts(stats({ loaded: 101 }))).toBe('120 of 449 downloaded, 101 loaded');
  });

  test('lists ignored before loaded', () => {
    expect(describeTabCounts(stats({ ignored: 3, loaded: 101 }))).toBe('120 of 449 downloaded, 3 ignored, 101 loaded');
  });
});

test('PUBLIC_ONLY_NOTE says members-only videos are excluded', () => {
  expect(PUBLIC_ONLY_NOTE).toMatch(/^Public videos only \(members-only excluded\)\./);
});

describe('describeTabStats', () => {
  test('describes downloaded out of total', () => {
    expect(describeTabStats(stats())).toBe(`120 of 449 downloaded. ${PUBLIC_ONLY_NOTE}`);
  });

  test('mentions ignored videos separately', () => {
    expect(describeTabStats(stats({ ignored: 3 }))).toBe(`120 of 449 downloaded, 3 ignored. ${PUBLIC_ONLY_NOTE}`);
  });

  test('says when the total has not been looked up', () => {
    expect(describeTabStats(stats({ total: null, percent: null }))).toBe('Not counted on YouTube yet.');
  });
});
