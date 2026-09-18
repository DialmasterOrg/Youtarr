import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { Channel } from '../../../../types/Channel';
import { renderWithProviders } from '../../../../test-utils';
import ChannelCard from '../ChannelCard';
import ChannelListRow from '../ChannelListRow';

const channel = {
  channel_id: 'UC123',
  url: 'https://www.youtube.com/channel/UC123',
  uploader: 'Example channel',
  title_filter_regex: '^Example',
};

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>;
}

describe.each([
  { layout: 'desktop card', Component: ChannelCard, isMobile: false },
  { layout: 'mobile card', Component: ChannelCard, isMobile: true },
  { layout: 'desktop row', Component: ChannelListRow, isMobile: false },
  { layout: 'mobile row', Component: ChannelListRow, isMobile: true },
])('$layout navigation', ({ Component, isMobile }) => {
  function renderChannel(overrides: { isPendingAddition?: boolean; channel?: Channel } = {}) {
    const onDelete = jest.fn();
    const onRegexClick = jest.fn();
    renderWithProviders(
      <>
        <Component
          channel={channel}
          isMobile={isMobile}
          globalPreferredResolution="1080"
          onDelete={onDelete}
          onRegexClick={onRegexClick}
          {...overrides}
        />
        <CurrentPath />
      </>
    );
    return { onDelete, onRegexClick };
  }

  test('exposes the channel URL as a native link and supports Enter', async () => {
    const user = userEvent.setup();
    renderChannel();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/channel/UC123');
    link.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('current-path')).toHaveTextContent('/channel/UC123');
  });

  test.each([
    { gesture: 'Ctrl-click', type: 'click', ctrlKey: true },
    { gesture: 'Cmd-click', type: 'click', metaKey: true },
    { gesture: 'Shift-click', type: 'click', shiftKey: true },
    { gesture: 'Alt-click', type: 'click', altKey: true },
    { gesture: 'middle-click', type: 'auxclick', button: 1 },
  ])('leaves $gesture to the browser without navigating the current tab', ({ gesture, type, ...modifiers }) => {
    renderChannel();
    // Observe the event after React handles it, then suppress jsdom's unsupported
    // native navigation. The application must leave the default action intact.
    const observeDefault = jest.fn((event: Event) => {
      expect(event.defaultPrevented).toBe(false);
      event.preventDefault();
    });
    document.addEventListener(type, observeDefault, { once: true });
    try {
      fireEvent(screen.getByRole('link'), new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        ...modifiers,
      }));
      expect(observeDefault).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('current-path')).toHaveTextContent(/^\/$/);
    } finally {
      document.removeEventListener(type, observeDefault);
    }
  });

  test('does not expose a link for a pending addition', () => {
    renderChannel({ isPendingAddition: true });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const navigationArea = screen.getByTestId(
      `${Component === ChannelCard ? 'channel-card' : 'channel-list-row'}-${channel.channel_id}`
    );
    expect(navigationArea).not.toHaveAttribute('role');
    expect(navigationArea).not.toHaveAttribute('tabindex');
    expect(navigationArea).not.toHaveAttribute('aria-label');
  });

  test.each([undefined, ''])('does not expose a link with channel ID %s', (channelId) => {
    renderChannel({ channel: { ...channel, channel_id: channelId } });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const navigationArea = screen.getByTestId(
      `${Component === ChannelCard ? 'channel-card' : 'channel-list-row'}-${channel.url}`
    );
    expect(navigationArea).not.toHaveAttribute('role');
    expect(navigationArea).not.toHaveAttribute('tabindex');
    expect(navigationArea).not.toHaveAttribute('aria-label');
  });

  test('allows removing an individual pending addition without navigation', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderChannel({ isPendingAddition: true });
    const remove = screen.getByRole('button', { name: 'Remove channel' });
    expect(remove).toBeEnabled();
    await user.click(remove);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-path')).toHaveTextContent(/^\/$/);
  });

  test.each([false, true])('opens defaults info without navigating (Ctrl-click: %s)', (ctrlKey) => {
    renderChannel();
    const link = within(screen.getByRole('link'));
    // Check every button so future controls cannot silently be nested in the link.
    expect(link.queryByRole('button')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Auto-download defaults info' }), { ctrlKey });
    expect(screen.getByText(/Available tabs .* have not been detected/)).toBeVisible();
    expect(screen.getByTestId('current-path')).toHaveTextContent(/^\/$/);
  });

  test('keeps Remove and Filters outside the link and does not navigate when used', async () => {
    const user = userEvent.setup();
    const { onDelete, onRegexClick } = renderChannel();
    const remove = screen.getByRole('button', { name: 'Remove channel' });
    const filter = screen.getByRole('button', { name: 'Filters' });
    const link = within(screen.getByRole('link'));
    expect(link.queryByRole('button', { name: 'Remove channel' })).not.toBeInTheDocument();
    expect(link.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
    await user.click(remove);
    await user.click(filter);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRegexClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-path')).toHaveTextContent(/^\/$/);
  });
});
