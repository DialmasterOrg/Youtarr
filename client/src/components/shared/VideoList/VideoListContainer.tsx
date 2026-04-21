import React from 'react';
import VideoListToolbar from './VideoListToolbar';
import VideoListFilterChips, { countActiveFilters } from './VideoListFilterChips';
import VideoListFilterPanel from './VideoListFilterPanel';
import VideoListSelectionPill from './VideoListSelectionPill';
import VideoListEmptyState from './VideoListEmptyState';
import {
  FilterConfig,
  PaginationMode,
  SortConfig,
  VideoListViewMode,
} from './types';
import { VideoListState } from './hooks/useVideoListState';
import { VideoSelectionState } from './hooks/useVideoSelection';

export interface VideoListContainerProps<IdType extends string | number> {
  state: VideoListState;
  selection?: VideoSelectionState<IdType>;

  viewModes?: VideoListViewMode[];
  filters?: FilterConfig[];
  sort?: SortConfig;
  searchPlaceholder?: string;

  headerSlot?: React.ReactNode;
  toolbarExtras?: React.ReactNode;
  toolbarRightActions?: React.ReactNode;
  tabsSlot?: React.ReactNode;
  customFilters?: React.ReactNode;

  itemCount: number;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string | null;
  renderContent: (viewMode: VideoListViewMode) => React.ReactNode;
  loadingSkeleton?: React.ReactNode;
  customEmptyMessage?: React.ReactNode;

  paginationMode?: PaginationMode;
  pagination?: React.ReactNode;
  infiniteScrollSentinel?: React.ReactNode;

  isMobile: boolean;
}

function VideoListContainer<IdType extends string | number>({
  state,
  selection,
  viewModes = ['grid', 'list', 'table'],
  filters = [],
  sort,
  searchPlaceholder,
  headerSlot,
  toolbarExtras,
  toolbarRightActions,
  tabsSlot,
  customFilters,
  itemCount,
  isLoading,
  isError,
  errorMessage,
  renderContent,
  loadingSkeleton,
  customEmptyMessage,
  pagination,
  infiniteScrollSentinel,
  isMobile,
}: VideoListContainerProps<IdType>) {
  const activeCount = countActiveFilters(filters);
  const filtersButtonActive = isMobile ? state.mobileFilterDrawerOpen : state.filterPanelOpen;

  const toggleFilters = () => {
    if (isMobile) {
      state.setMobileActionsOpen(false);
      state.setMobileFilterDrawerOpen(!state.mobileFilterDrawerOpen);
    } else {
      state.setFilterPanelOpen(!state.filterPanelOpen);
    }
  };

  const hasFilters = activeCount > 0;
  const hasSearch = Boolean(state.search);
  const hasContent = itemCount > 0;

  return (
    <div data-testid="video-list-container">
      {headerSlot && <div>{headerSlot}</div>}

      <div style={{ padding: isMobile ? '10px 10px 0 10px' : '12px 16px 0 16px' }}>
        <VideoListToolbar
          state={state}
          viewModes={viewModes}
          searchPlaceholder={searchPlaceholder}
          filtersButtonActive={filtersButtonActive}
          filtersBadgeCount={activeCount}
          onFiltersClick={filters.length > 0 ? toggleFilters : undefined}
          sort={sort}
          toolbarExtras={toolbarExtras}
          rightActions={toolbarRightActions}
          isMobile={isMobile}
        />
        {activeCount > 0 && <VideoListFilterChips filters={filters} />}
      </div>

      <VideoListFilterPanel
        filters={filters}
        variant={isMobile ? 'drawer' : 'inline'}
        open={isMobile ? state.mobileFilterDrawerOpen : state.filterPanelOpen}
        onClose={() => {
          if (isMobile) state.setMobileFilterDrawerOpen(false);
          else state.setFilterPanelOpen(false);
        }}
        customFilters={customFilters}
      />

      {tabsSlot && <div>{tabsSlot}</div>}

      <div
        style={{
          padding: isMobile ? 10 : 12,
          paddingTop: isMobile ? 8 : 12,
          paddingBottom: isMobile && selection?.hasSelection ? 96 : 16,
          position: 'relative',
          minHeight: hasContent ? undefined : 240,
        }}
      >
        {!hasContent ? (
          <VideoListEmptyState
            isLoading={isLoading}
            isError={isError}
            errorMessage={errorMessage}
            hasFilters={hasFilters}
            hasSearch={hasSearch}
            customEmptyMessage={customEmptyMessage}
            loadingSkeleton={loadingSkeleton}
          />
        ) : (
          renderContent(state.viewMode)
        )}

        {infiniteScrollSentinel}
      </div>

      {pagination}

      {selection && <VideoListSelectionPill selection={selection} isMobile={isMobile} />}
    </div>
  );
}

export default VideoListContainer;
