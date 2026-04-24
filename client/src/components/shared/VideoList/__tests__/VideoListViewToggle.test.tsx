import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoListViewToggle from '../VideoListViewToggle';
import { renderWithProviders } from '../../../../test-utils';

describe('VideoListViewToggle', () => {
  test('renders only the configured modes', () => {
    renderWithProviders(
      <VideoListViewToggle value="grid" modes={['grid', 'table']} onChange={jest.fn()} />
    );
    expect(screen.getByTestId('view-mode-grid')).toBeInTheDocument();
    expect(screen.getByTestId('view-mode-table')).toBeInTheDocument();
    expect(screen.queryByTestId('view-mode-list')).not.toBeInTheDocument();
  });

  test('marks the active mode with aria-pressed', () => {
    renderWithProviders(
      <VideoListViewToggle value="list" modes={['grid', 'list', 'table']} onChange={jest.fn()} />
    );
    expect(screen.getByTestId('view-mode-list')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('view-mode-grid')).toHaveAttribute('aria-pressed', 'false');
  });

  test('fires onChange with the clicked mode', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <VideoListViewToggle value="grid" modes={['grid', 'list', 'table']} onChange={onChange} />
    );
    await user.click(screen.getByTestId('view-mode-table'));
    expect(onChange).toHaveBeenCalledWith('table');
  });
});
