import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SubscriptionsFilter from '../SubscriptionsFilter';
import { renderWithProviders } from '../../../../test-utils';

describe('SubscriptionsFilter', () => {
  test('renders only the Channels and Playlists chips (no "All")', () => {
    renderWithProviders(<SubscriptionsFilter value="channels" onChange={jest.fn()} />);

    expect(screen.getByText('Channels')).toBeInTheDocument();
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.queryByText('All')).not.toBeInTheDocument();
  });

  test('shows counts when provided', () => {
    renderWithProviders(
      <SubscriptionsFilter value="channels" onChange={jest.fn()} counts={{ channels: 4, playlists: 2 }} />
    );

    expect(screen.getByText('Channels (4)')).toBeInTheDocument();
    expect(screen.getByText('Playlists (2)')).toBeInTheDocument();
  });

  test('calls onChange with "playlists" when the Playlists chip is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(<SubscriptionsFilter value="channels" onChange={onChange} />);

    await user.click(screen.getByText('Playlists'));
    expect(onChange).toHaveBeenCalledWith('playlists');
  });

  test('calls onChange with "channels" when the Channels chip is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(<SubscriptionsFilter value="playlists" onChange={onChange} />);

    await user.click(screen.getByText('Channels'));
    expect(onChange).toHaveBeenCalledWith('channels');
  });
});
