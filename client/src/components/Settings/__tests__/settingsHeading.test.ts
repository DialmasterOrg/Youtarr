import { settingsHeading } from '../settingsHeading';

describe('settingsHeading', () => {
  test('titles pages by their first path segment', () => {
    expect(settingsHeading('/settings')).toBe('Settings');
    expect(settingsHeading('/settings/core')).toBe('Settings / Core');
    expect(settingsHeading('/settings/downloading')).toBe('Settings / YT-DLP');
  });

  test('the library page renders its own heading', () => {
    expect(settingsHeading('/settings/library')).toBeNull();
    expect(settingsHeading('/settings/library/Kids')).toBeNull();
  });
});
