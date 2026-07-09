import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscriptionsBackButton from '../SubscriptionsBackButton';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('SubscriptionsBackButton', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  test('renders a labelled back control', () => {
    render(<SubscriptionsBackButton tab="channels" />);
    expect(
      screen.getByRole('button', { name: 'Back to Channels & Playlists' })
    ).toBeInTheDocument();
    expect(screen.getByText('Channels & Playlists')).toBeInTheDocument();
  });

  test('navigates to subscriptions with the channels tab in location state', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsBackButton tab="channels" />);
    await user.click(screen.getByRole('button', { name: 'Back to Channels & Playlists' }));
    expect(mockNavigate).toHaveBeenCalledWith('/subscriptions', {
      state: { tab: 'channels' },
    });
  });

  test('navigates to subscriptions with the playlists tab in location state', async () => {
    const user = userEvent.setup();
    render(<SubscriptionsBackButton tab="playlists" />);
    await user.click(screen.getByRole('button', { name: 'Back to Channels & Playlists' }));
    expect(mockNavigate).toHaveBeenCalledWith('/subscriptions', {
      state: { tab: 'playlists' },
    });
  });
});
