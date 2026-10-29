import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChannelLinks } from '../ChannelLinks';
import { renderInPage } from '../../__tests__/renderPage';

describe('ChannelLinks', () => {
  test('shows eight, then expands the rest', async () => {
    const channels = Array.from({ length: 10 }, (_, i) => ({ channelId: `UC${i}`, name: `Channel ${i}` }));
    renderInPage(<ChannelLinks channels={channels} />);
    expect(screen.getAllByRole('link')).toHaveLength(8);
    await userEvent.click(screen.getByRole('button', { name: 'and 2 more' }));
    expect(screen.getAllByRole('link')).toHaveLength(10);
  });
});
