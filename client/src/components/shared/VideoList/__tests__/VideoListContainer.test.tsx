import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoListContainer from '../VideoListContainer';
import { useVideoListState } from '../hooks/useVideoListState';
import { renderWithProviders } from '../../../../test-utils';

interface HarnessProps {
  isLoading?: boolean;
  itemCount?: number;
  paginationMode?: 'pages' | 'infinite';
}

function Harness({
  isLoading = false,
  itemCount = 0,
  paginationMode = 'pages',
}: HarnessProps) {
  const state = useVideoListState({ initialViewMode: 'grid' });
  return (
    <VideoListContainer
      state={state}
      itemCount={itemCount}
      isLoading={isLoading}
      isError={false}
      paginationMode={paginationMode}
      renderContent={() => (
        <div data-testid="content">{itemCount} items</div>
      )}
      isMobile={false}
    />
  );
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
});
