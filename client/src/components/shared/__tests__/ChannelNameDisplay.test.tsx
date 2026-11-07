import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChannelNameDisplay from '../ChannelNameDisplay';

function renderDisplay(props = {}) {
  const defaults = {
    channelName: 'Alpha Channel',
    enabledChannelId: null as string | null,
    videoChannelId: null as string | null | undefined,
    variant: 'caption' as const,
    onAddChannel: jest.fn(),
  };
  const merged = { ...defaults, ...props };
  render(
    <MemoryRouter>
      <ChannelNameDisplay {...merged} />
    </MemoryRouter>
  );
  return merged;
}

describe('ChannelNameDisplay', () => {
  test('subscribed channel renders a link to the channel page', () => {
    renderDisplay({ enabledChannelId: 'UCa' });
    const link = screen.getByRole('link', { name: 'Alpha Channel' });
    expect(link).toHaveAttribute('href', '/channel/UCa');
  });

  test('unsubscribed channel with a channel id renders the add affordance', () => {
    const view = renderDisplay({ videoChannelId: 'UCb' });
    fireEvent.click(screen.getByRole('button', { name: /alpha channel/i }));
    expect(view.onAddChannel).toHaveBeenCalledWith(
      'Alpha Channel',
      'https://www.youtube.com/channel/UCb'
    );
  });

  test('add affordance activates via keyboard', () => {
    const view = renderDisplay({ videoChannelId: 'UCb' });
    fireEvent.keyDown(screen.getByRole('button', { name: /alpha channel/i }), { key: 'Enter' });
    expect(view.onAddChannel).toHaveBeenCalledTimes(1);
  });

  test('unsubscribed channel without a channel id renders plain text', () => {
    renderDisplay();
    expect(screen.getByText('Alpha Channel')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  test('add affordance shows the add icon', () => {
    renderDisplay({ videoChannelId: 'UCb' });
    expect(screen.getByTestId('add-channel-icon')).toBeInTheDocument();
  });

  test('subscribed link does not show the add icon', () => {
    renderDisplay({ enabledChannelId: 'UCa' });
    expect(screen.queryByTestId('add-channel-icon')).not.toBeInTheDocument();
  });

  test('plain text does not show the add icon', () => {
    renderDisplay();
    expect(screen.queryByTestId('add-channel-icon')).not.toBeInTheDocument();
  });
});
