import { CHANNEL_TABS, CHANNEL_TAB_TYPES, getTabLabel, getTabMediaType, isChannelTab } from '../channelTabs';

test('lists the tabs in display order', () => {
  expect(CHANNEL_TAB_TYPES).toEqual(['videos', 'shorts', 'streams']);
});

test('names each tab in the auto-download settings', () => {
  expect(CHANNEL_TAB_TYPES.map((tab) => CHANNEL_TABS[tab].autoDownloadLabel)).toEqual([
    'New Videos',
    'New Shorts',
    'New Live/Streams',
  ]);
});

describe('isChannelTab', () => {
  test.each(['videos', 'shorts', 'streams'])('knows the %s tab', (tabType) => {
    expect(isChannelTab(tabType)).toBe(true);
  });

  test.each(['podcasts', 'constructor'])('does not know %s', (tabType) => {
    expect(isChannelTab(tabType)).toBe(false);
  });
});

describe('getTabLabel', () => {
  test.each([
    ['videos', 'Videos'],
    ['shorts', 'Shorts'],
    ['streams', 'Live'],
  ])('labels the %s tab %s', (tabType, label) => {
    expect(getTabLabel(tabType)).toBe(label);
  });

  test('shows a tab type it does not know as it is', () => {
    expect(getTabLabel('podcasts')).toBe('podcasts');
  });
});

describe('getTabMediaType', () => {
  test.each([
    ['videos', 'video'],
    ['shorts', 'short'],
    ['streams', 'livestream'],
  ])('maps the %s tab to the %s media type', (tabType, mediaType) => {
    expect(getTabMediaType(tabType)).toBe(mediaType);
  });

  test('has no media type for a tab type it does not know', () => {
    expect(getTabMediaType('podcasts')).toBeUndefined();
  });
});
