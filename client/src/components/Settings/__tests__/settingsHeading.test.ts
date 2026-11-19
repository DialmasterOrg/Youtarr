import { settingsHeading } from '../settingsHeading';

describe('settingsHeading', () => {
  test('titles pages by their first path segment', () => {
    expect(settingsHeading('/settings')).toEqual({ subPage: null });
    expect(settingsHeading('/settings/core')).toEqual({ subPage: 'Core' });
    expect(settingsHeading('/settings/downloading')).toEqual({ subPage: 'YT-DLP' });
  });

  test('the library page renders its own heading', () => {
    expect(settingsHeading('/settings/library')).toBeNull();
    expect(settingsHeading('/settings/library/Kids')).toBeNull();
  });
});
