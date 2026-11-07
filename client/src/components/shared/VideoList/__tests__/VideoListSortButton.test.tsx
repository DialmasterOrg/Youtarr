import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoListSortButton from '../VideoListSortButton';
import { SortConfig } from '../types';
import { renderWithProviders } from '../../../../test-utils';

function buildSort(overrides: Partial<SortConfig> = {}): SortConfig {
  return {
    options: [
      { key: 'relevance', label: 'Relevance', undirected: true },
      { key: 'published', label: 'Published' },
    ],
    activeKey: 'published',
    direction: 'desc',
    onChange: jest.fn(),
    ...overrides,
  };
}

describe('VideoListSortButton', () => {
  test('shows the active label with a direction arrow for a directional sort', () => {
    renderWithProviders(<VideoListSortButton sort={buildSort()} />);
    const button = screen.getByTestId('video-list-sort-button');
    expect(button).toHaveTextContent('Sort: Published');
    expect(screen.getByTestId('sort-direction-desc')).toBeInTheDocument();
  });

  test('hides the direction arrow while an undirected sort is active', () => {
    renderWithProviders(<VideoListSortButton sort={buildSort({ activeKey: 'relevance' })} />);
    expect(screen.getByTestId('video-list-sort-button')).toHaveTextContent('Sort: Relevance');
    expect(screen.queryByTestId('sort-direction-desc')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sort-direction-asc')).not.toBeInTheDocument();
  });

  test('choosing a different option sorts it descending', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(<VideoListSortButton sort={buildSort({ activeKey: 'relevance', onChange })} />);
    await user.click(screen.getByTestId('video-list-sort-button'));
    await user.click(await screen.findByRole('menuitem', { name: /published/i }));
    expect(onChange).toHaveBeenCalledWith('published', 'desc');
  });

  test('choosing the active directional option flips its direction', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(<VideoListSortButton sort={buildSort({ onChange })} />);
    await user.click(screen.getByTestId('video-list-sort-button'));
    await user.click(await screen.findByRole('menuitem', { name: /published/i }));
    expect(onChange).toHaveBeenCalledWith('published', 'asc');
  });

  test('choosing the active undirected option changes nothing', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(<VideoListSortButton sort={buildSort({ activeKey: 'relevance', onChange })} />);
    await user.click(screen.getByTestId('video-list-sort-button'));
    await user.click(await screen.findByRole('menuitem', { name: /relevance/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
