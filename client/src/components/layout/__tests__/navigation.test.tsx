import React from 'react';
import { isNavItemExpanded, isNavItemSelected, isNavSubItemActive } from '../navigation';

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
    const library = { to: '/settings/library', matchPrefix: true };
    expect(isNavSubItemActive('/settings/library', library)).toBe(true);
    expect(isNavSubItemActive('/settings/library/Kids', library)).toBe(true);
    expect(isNavSubItemActive('/settings/libraryx', library)).toBe(false);
  });

  test('other sub-items match exactly, so /videos is not active on /videos/find', () => {
    expect(isNavSubItemActive('/videos/find', { to: '/videos' })).toBe(false);
  });
});
