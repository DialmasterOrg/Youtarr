import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoListContainer from '../VideoListContainer';
import { useVideoListState } from '../hooks/useVideoListState';
import { FilterConfig } from '../types';
import { renderWithProviders } from '../../../../test-utils';

interface HarnessProps {
  isLoading?: boolean;
  itemCount?: number;
  paginationMode?: 'pages' | 'infinite';
  filters?: FilterConfig[];
  isMobile?: boolean;
}

function Harness({
  isLoading = false,
  itemCount = 0,
  paginationMode = 'pages',
  filters,
  isMobile = false,
}: HarnessProps) {
  const state = useVideoListState({ initialViewMode: 'grid' });
  return (
    <VideoListContainer
      state={state}
      itemCount={itemCount}
      isLoading={isLoading}
      isError={false}
      paginationMode={paginationMode}
      filters={filters}
      renderContent={() => (
        <div data-testid="content">{itemCount} items</div>
      )}
      isMobile={isMobile}
    />
  );
}

function activeFilters(): FilterConfig[] {
  return [{ id: 'missing', value: 'only', onChange: jest.fn() }];
}

describe('VideoListContainer', () => {
  test('renders top and bottom loading bars during a paginated refetch with existing content', () => {
    renderWithProviders(
      <Harness isLoading itemCount={10} paginationMode="pages" />
    );
    expect(screen.getByTestId('video-list-loading-bar-top')).toBeInTheDocument();
    expect(screen.getByTestId('video-list-loading-bar-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  test('does not render loading bars in infinite scroll mode', () => {
    renderWithProviders(
      <Harness isLoading itemCount={10} paginationMode="infinite" />
    );
    expect(screen.queryByTestId('video-list-loading-bar-top')).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-list-loading-bar-bottom')).not.toBeInTheDocument();
  });

  test('does not render loading bars when there is no content yet', () => {
    renderWithProviders(
      <Harness isLoading itemCount={0} paginationMode="pages" />
    );
    expect(screen.queryByTestId('video-list-loading-bar-top')).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-list-loading-bar-bottom')).not.toBeInTheDocument();
  });

  test('does not render loading bars when not loading', () => {
    renderWithProviders(
      <Harness isLoading={false} itemCount={10} paginationMode="pages" />
    );
    expect(screen.queryByTestId('video-list-loading-bar-top')).not.toBeInTheDocument();
    expect(screen.queryByTestId('video-list-loading-bar-bottom')).not.toBeInTheDocument();
  });

  describe('active filter chips', () => {
    test('shows the chips while the filter panel is closed', () => {
      renderWithProviders(<Harness filters={activeFilters()} />);
      expect(screen.getByTestId('video-list-filter-chips')).toBeInTheDocument();
    });

    test('hides the chips while the inline filter panel is open', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Harness filters={activeFilters()} />);

      await user.click(screen.getByTestId('video-list-filters-button'));

      expect(screen.getByTestId('video-list-filter-panel-inline')).toBeInTheDocument();
      expect(screen.queryByTestId('video-list-filter-chips')).not.toBeInTheDocument();
    });

    test('shows the chips again after the inline filter panel closes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Harness filters={activeFilters()} />);

      await user.click(screen.getByTestId('video-list-filters-button'));
      await user.click(screen.getByTestId('video-list-filters-button'));

      expect(screen.getByTestId('video-list-filter-chips')).toBeInTheDocument();
    });

    test('keeps the chips while the mobile filter drawer is open', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Harness filters={activeFilters()} isMobile />);

      await user.click(screen.getByTestId('video-list-filters-button'));

      expect(screen.getByTestId('video-list-filter-drawer')).toBeInTheDocument();
      expect(screen.getByTestId('video-list-filter-chips')).toBeInTheDocument();
    });
  });
});
