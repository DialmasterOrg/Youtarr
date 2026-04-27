import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoListToolbar from '../VideoListToolbar';
import { SortConfig, VideoListViewMode } from '../types';
import { VideoListState } from '../hooks/useVideoListState';
import { renderWithProviders } from '../../../../test-utils';

function buildState(overrides: Partial<VideoListState> = {}): VideoListState {
  return {
    searchInput: '',
    search: '',
    setSearchInput: jest.fn(),
    clearSearch: jest.fn(),
    viewMode: 'grid',
    setViewMode: jest.fn(),
    filterPanelOpen: false,
    setFilterPanelOpen: jest.fn(),
    mobileFilterDrawerOpen: false,
    setMobileFilterDrawerOpen: jest.fn(),
    mobileActionsOpen: false,
    setMobileActionsOpen: jest.fn(),
    ...overrides,
  };
}

const VIEW_MODES: VideoListViewMode[] = ['grid', 'list', 'table'];

function buildSort(overrides: Partial<SortConfig> = {}): SortConfig {
  return {
    options: [
      { key: 'date', label: 'Date' },
      { key: 'title', label: 'Title' },
    ],
    activeKey: 'date',
    direction: 'desc',
    onChange: jest.fn(),
    ...overrides,
  };
}

describe('VideoListToolbar', () => {
  test('renders the search input wired to state.setSearchInput', async () => {
    const user = userEvent.setup();
    const setSearchInput = jest.fn();
    renderWithProviders(
      <VideoListToolbar
        state={buildState({ setSearchInput })}
        viewModes={VIEW_MODES}
        isMobile={false}
      />
    );
    const searchBox = screen.getByPlaceholderText('Search videos...');
    await user.type(searchBox, 'a');
    expect(setSearchInput).toHaveBeenCalledWith('a');
  });

  test('uses a custom search placeholder when provided', () => {
    renderWithProviders(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        searchPlaceholder="Find a clip"
        isMobile={false}
      />
    );
    expect(screen.getByPlaceholderText('Find a clip')).toBeInTheDocument();
  });

  test('omits the filters button when onFiltersClick is not supplied', () => {
    renderWithProviders(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        isMobile={false}
      />
    );
    expect(screen.queryByTestId('video-list-filters-button')).not.toBeInTheDocument();
  });

  test('renders the filters button and forwards clicks', async () => {
    const user = userEvent.setup();
    const onFiltersClick = jest.fn();
    renderWithProviders(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        onFiltersClick={onFiltersClick}
        filtersBadgeCount={3}
        isMobile={false}
      />
    );
    const filtersButton = screen.getByTestId('video-list-filters-button');
    expect(filtersButton).toHaveTextContent('Filters');
    expect(screen.getByText('3')).toBeInTheDocument();
    await user.click(filtersButton);
    expect(onFiltersClick).toHaveBeenCalledTimes(1);
  });

  test('omits the sort button when sort prop is missing', () => {
    renderWithProviders(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        isMobile={false}
      />
    );
    expect(screen.queryByTestId('video-list-sort-button')).not.toBeInTheDocument();
  });

  test('shows the active sort label on the sort button', () => {
    renderWithProviders(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        sort={buildSort({ activeKey: 'title' })}
        isMobile={false}
      />
    );
    expect(screen.getByTestId('video-list-sort-button')).toHaveTextContent('Sort: Title');
  });

  test('clicking a different sort option calls onChange with desc direction', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        sort={buildSort({ activeKey: 'date', direction: 'asc', onChange })}
        isMobile={false}
      />
    );
    await user.click(screen.getByTestId('video-list-sort-button'));
    await user.click(await screen.findByRole('menuitem', { name: /title/i }));
    expect(onChange).toHaveBeenCalledWith('title', 'desc');
  });

  test('clicking the active sort option toggles direction', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    renderWithProviders(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        sort={buildSort({ activeKey: 'date', direction: 'desc', onChange })}
        isMobile={false}
      />
    );
    await user.click(screen.getByTestId('video-list-sort-button'));
    await user.click(await screen.findByRole('menuitem', { name: /date/i }));
    expect(onChange).toHaveBeenCalledWith('date', 'asc');
  });

  test('renders rightActions in both desktop and mobile layouts', () => {
    const { rerender } = renderWithProviders(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        rightActions={<button data-testid="right-action">Action</button>}
        isMobile={false}
      />
    );
    expect(screen.getByTestId('right-action')).toBeInTheDocument();

    rerender(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        rightActions={<button data-testid="right-action">Action</button>}
        isMobile
      />
    );
    expect(screen.getByTestId('right-action')).toBeInTheDocument();
  });

  test('renders toolbarExtras only when provided', () => {
    renderWithProviders(
      <VideoListToolbar
        state={buildState()}
        viewModes={VIEW_MODES}
        toolbarExtras={<span data-testid="extras">Extras</span>}
        isMobile
      />
    );
    expect(screen.getByTestId('extras')).toBeInTheDocument();
  });
});
