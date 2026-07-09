import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlaylistSortControl from '../PlaylistSortControl';

describe('PlaylistSortControl', () => {
  test('shows the current sort order as the selected value', () => {
    render(<PlaylistSortControl value="desc" onChange={jest.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Sort' });
    expect(trigger).toHaveTextContent('Reverse playlist order');
  });

  test('renders all sort options when opened', async () => {
    render(<PlaylistSortControl value="desc" onChange={jest.fn()} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));

    expect(await screen.findByRole('option', { name: 'Playlist order' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Reverse playlist order' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Recently added first' })).toBeInTheDocument();
  });

  test('calls onChange with the chosen order', async () => {
    const onChange = jest.fn();
    render(<PlaylistSortControl value="desc" onChange={onChange} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Playlist order' }));

    expect(onChange).toHaveBeenCalledWith('asc');
  });

  test('calls onChange with recent when the new option is chosen', async () => {
    const onChange = jest.fn();
    render(<PlaylistSortControl value="desc" onChange={onChange} />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Recently added first' }));

    expect(onChange).toHaveBeenCalledWith('recent');
  });

  test('does not open when disabled', () => {
    render(<PlaylistSortControl value="desc" onChange={jest.fn()} disabled />);

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));

    expect(screen.queryByRole('option', { name: 'Playlist order' })).not.toBeInTheDocument();
  });
});
