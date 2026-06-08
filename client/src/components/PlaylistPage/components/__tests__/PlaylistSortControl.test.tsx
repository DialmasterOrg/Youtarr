import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlaylistSortControl from '../PlaylistSortControl';

describe('PlaylistSortControl', () => {
  test('shows the current sort order as the selected value', () => {
    render(<PlaylistSortControl value="desc" onChange={jest.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Sort' });
    expect(trigger).toHaveTextContent('Newest first');
  });

  test('renders both sort options when opened', async () => {
    render(<PlaylistSortControl value="desc" onChange={jest.fn()} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));

    expect(await screen.findByRole('option', { name: 'Newest first' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Oldest first' })).toBeInTheDocument();
  });

  test('calls onChange with the chosen order', async () => {
    const onChange = jest.fn();
    render(<PlaylistSortControl value="desc" onChange={onChange} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Oldest first' }));

    expect(onChange).toHaveBeenCalledWith('asc');
  });

  test('does not open when disabled', () => {
    render(<PlaylistSortControl value="desc" onChange={jest.fn()} disabled />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));

    expect(screen.queryByRole('option', { name: 'Oldest first' })).not.toBeInTheDocument();
  });
});
