import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlaylistWatchedFilterControl from '../PlaylistWatchedFilterControl';

describe('PlaylistWatchedFilterControl', () => {
  test('shows the current value', () => {
    render(<PlaylistWatchedFilterControl value="all" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Watched')).toHaveTextContent('All');
  });

  test('offers all three watched states and reports a selection', async () => {
    const onChange = jest.fn();
    render(<PlaylistWatchedFilterControl value="all" onChange={onChange} />);

    fireEvent.mouseDown(screen.getByLabelText('Watched'));
    expect(await screen.findByRole('option', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Unwatched' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Watched' }));

    expect(onChange).toHaveBeenCalledWith('watched');
  });

  test('renders the non-default value', () => {
    render(<PlaylistWatchedFilterControl value="not_watched" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Watched')).toHaveTextContent('Unwatched');
  });

  test('is disabled when the disabled prop is set', () => {
    render(<PlaylistWatchedFilterControl value="all" onChange={jest.fn()} disabled />);
    expect(screen.getByLabelText('Watched')).toBeDisabled();
  });
});
