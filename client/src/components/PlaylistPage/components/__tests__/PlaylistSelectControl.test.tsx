import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlaylistSelectControl, {
  DOWNLOAD_FILTER_OPTIONS,
  SORT_OPTIONS,
  WATCHED_FILTER_OPTIONS,
} from '../PlaylistSelectControl';

const renderSort = (props: { onChange?: jest.Mock; disabled?: boolean } = {}) =>
  render(
    <PlaylistSelectControl
      label="Sort"
      value="desc"
      options={SORT_OPTIONS}
      onChange={props.onChange ?? jest.fn()}
      disabled={props.disabled}
    />
  );

describe('PlaylistSelectControl', () => {
  test('shows the current value under its label', () => {
    renderSort();
    expect(screen.getByRole('button', { name: 'Sort' })).toHaveTextContent('Reverse playlist order');
  });

  test('renders every option when opened', async () => {
    renderSort();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));

    expect(await screen.findByRole('option', { name: 'Playlist order' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(SORT_OPTIONS.length);
  });

  test('calls onChange with the chosen value', async () => {
    const onChange = jest.fn();
    renderSort({ onChange });

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Recently discovered by Youtarr' }));

    expect(onChange).toHaveBeenCalledWith('recent');
  });

  test('does not open when disabled', () => {
    renderSort({ disabled: true });

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Sort' }));

    expect(screen.queryByRole('option', { name: 'Playlist order' })).not.toBeInTheDocument();
  });

  test('offers the download filter states', async () => {
    const onChange = jest.fn();
    render(<PlaylistSelectControl label="Show" value="all" options={DOWNLOAD_FILTER_OPTIONS} onChange={onChange} />);

    expect(screen.getByLabelText('Show')).toHaveTextContent('All videos');
    fireEvent.mouseDown(screen.getByLabelText('Show'));
    expect(await screen.findByRole('option', { name: 'Not downloaded' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Downloaded' }));

    expect(onChange).toHaveBeenCalledWith('downloaded');
  });

  test('offers the watched filter states', async () => {
    const onChange = jest.fn();
    render(<PlaylistSelectControl label="Watched" value="all" options={WATCHED_FILTER_OPTIONS} onChange={onChange} />);

    fireEvent.mouseDown(screen.getByLabelText('Watched'));
    fireEvent.click(await screen.findByRole('option', { name: 'Unwatched' }));

    expect(onChange).toHaveBeenCalledWith('not_watched');
  });
});
