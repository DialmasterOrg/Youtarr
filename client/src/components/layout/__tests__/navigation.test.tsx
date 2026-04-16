import React from 'react';
import { isNavItemExpanded, isNavItemSelected, isNavPathActive } from '../navigation';

const channelsItem = {
  key: 'channels',
  label: 'Channels',
  icon: <span>ChannelsIcon</span>,
  to: '/channels',
  subItems: [
    { key: 'channels-list', label: 'Your Channels', to: '/channels' },
    { key: 'channels-subscriptions', label: 'Imports', to: '/channels/imports' },
  ],
};

describe('navigation helpers', () => {
  it('keeps channels expanded but not selected on the imports subpage', () => {
    expect(isNavPathActive('/channels/imports', '/channels')).toBe(false);
    expect(isNavPathActive('/channels/imports', '/channels/imports')).toBe(true);
    expect(isNavItemSelected('/channels/imports', channelsItem)).toBe(false);
    expect(isNavItemExpanded('/channels/imports', channelsItem)).toBe(true);
  });

  it('keeps channels selected on the root and channel detail pages', () => {
    expect(isNavItemSelected('/channels', channelsItem)).toBe(true);
    expect(isNavItemSelected('/channel/abc123', channelsItem)).toBe(true);
  });
});