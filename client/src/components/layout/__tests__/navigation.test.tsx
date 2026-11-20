import React from 'react';
import { groupNavSubItems, isNavItemExpanded, isNavItemSelected, isNavSubItemActive } from '../navigation';

const subscriptionsItem = {
  key: 'subscriptions',
  label: 'Channels & Playlists',
  icon: <span>SubscriptionsIcon</span>,
  to: '/subscriptions',
  subItems: [
    { key: 'subscriptions-list', label: 'Your Channels', to: '/subscriptions' },
    { key: 'subscriptions-imports', label: 'Imports', to: '/subscriptions/imports' },
  ],
};

describe('navigation helpers', () => {
  it('keeps subscriptions expanded but not selected on the imports subpage', () => {
    expect(isNavSubItemActive('/subscriptions/imports', { to: '/subscriptions' })).toBe(false);
    expect(isNavSubItemActive('/subscriptions/imports', { to: '/subscriptions/imports' })).toBe(true);
    expect(isNavItemSelected('/subscriptions/imports', subscriptionsItem)).toBe(false);
    expect(isNavItemExpanded('/subscriptions/imports', subscriptionsItem)).toBe(true);
  });

  it('keeps subscriptions selected on the root and channel or playlist detail pages', () => {
    expect(isNavItemSelected('/subscriptions', subscriptionsItem)).toBe(true);
    expect(isNavItemSelected('/channel/abc123', subscriptionsItem)).toBe(true);
    expect(isNavItemSelected('/playlist/42', subscriptionsItem)).toBe(true);
  });
});

describe('isNavSubItemActive', () => {
  test('a prefix sub-item stays active on paths under it', () => {
    const page = { to: '/settings/plex', matchPrefix: true };
    expect(isNavSubItemActive('/settings/plex', page)).toBe(true);
    expect(isNavSubItemActive('/settings/plex/libraries', page)).toBe(true);
    expect(isNavSubItemActive('/settings/plexx', page)).toBe(false);
  });

  test('other sub-items match exactly, so /videos is not active on /videos/find', () => {
    expect(isNavSubItemActive('/videos/find', { to: '/videos' })).toBe(false);
  });
});

describe('groupNavSubItems', () => {
  const item = (key: string, group?: string) => ({ key, label: key, to: `/settings/${key}`, group });

  test('splits sub-items into one section per group, keeping their order', () => {
    const sections = groupNavSubItems([item('core', 'Downloads'), item('cookies', 'Downloads'), item('plex', 'Media servers')]);
    expect(sections.map((section) => [section.group, section.items.map((subItem) => subItem.key)])).toEqual([
      ['Downloads', ['core', 'cookies']],
      ['Media servers', ['plex']],
    ]);
  });

  test('puts sub-items without a group in one unnamed section', () => {
    const sections = groupNavSubItems([item('manual'), item('activity')]);
    expect(sections).toHaveLength(1);
    expect(sections[0].group).toBeNull();
    expect(sections[0].items).toHaveLength(2);
  });

  test('returns no sections for no sub-items', () => {
    expect(groupNavSubItems([])).toEqual([]);
  });
});
