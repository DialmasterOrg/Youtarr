import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlaylistDownloadFilterControl from '../PlaylistDownloadFilterControl';

describe('PlaylistDownloadFilterControl', () => {
  test('shows the current value', () => {
    render(<PlaylistDownloadFilterControl value="all" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Show')).toHaveTextContent('All videos');
  });

  test('offers all three download states and reports a selection', async () => {
    const onChange = jest.fn();
    render(<PlaylistDownloadFilterControl value="all" onChange={onChange} />);

    fireEvent.mouseDown(screen.getByLabelText('Show'));
    expect(await screen.findByRole('option', { name: 'All videos' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Not downloaded' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Downloaded' }));

    expect(onChange).toHaveBeenCalledWith('downloaded');
  });

  test('renders the non-default value', () => {
    render(<PlaylistDownloadFilterControl value="not_downloaded" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Show')).toHaveTextContent('Not downloaded');
  });

  test('is disabled when the disabled prop is set', () => {
    render(<PlaylistDownloadFilterControl value="all" onChange={jest.fn()} disabled />);
    expect(screen.getByLabelText('Show')).toBeDisabled();
  });
});
