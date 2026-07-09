import React from 'react';
import { isNavItemExpanded, isNavItemSelected, isNavPathActive } from '../navigation';

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
    expect(isNavPathActive('/subscriptions/imports', '/subscriptions')).toBe(false);
    expect(isNavPathActive('/subscriptions/imports', '/subscriptions/imports')).toBe(true);
    expect(isNavItemSelected('/subscriptions/imports', subscriptionsItem)).toBe(false);
    expect(isNavItemExpanded('/subscriptions/imports', subscriptionsItem)).toBe(true);
  });

  it('keeps subscriptions selected on the root and channel or playlist detail pages', () => {
    expect(isNavItemSelected('/subscriptions', subscriptionsItem)).toBe(true);
    expect(isNavItemSelected('/channel/abc123', subscriptionsItem)).toBe(true);
    expect(isNavItemSelected('/playlist/42', subscriptionsItem)).toBe(true);
  });
});
