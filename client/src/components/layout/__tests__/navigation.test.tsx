import React from 'react';
import { isNavItemExpanded, isNavItemSelected, isNavPathActive } from '../navigation';

const channelsItem = {
  key: 'channels',
  label: 'Channels',
  icon: <span>ChannelsIcon</span>,
  to: '/channels',
  subItems: [
    { key: 'channels-list', label: 'Channels', to: '/channels' },
    { key: 'channels-subscriptions', label: 'Subscriptions', to: '/channels/subscriptions' },
  ],
};

describe('navigation helpers', () => {
  it('keeps channels expanded but not selected on the subscriptions subpage', () => {
    expect(isNavPathActive('/channels/subscriptions', '/channels')).toBe(false);
    expect(isNavPathActive('/channels/subscriptions', '/channels/subscriptions')).toBe(true);
    expect(isNavItemSelected('/channels/subscriptions', channelsItem)).toBe(false);
    expect(isNavItemExpanded('/channels/subscriptions', channelsItem)).toBe(true);
  });

  it('keeps channels selected on the root and channel detail pages', () => {
    expect(isNavItemSelected('/channels', channelsItem)).toBe(true);
    expect(isNavItemSelected('/channel/abc123', channelsItem)).toBe(true);
  });
});