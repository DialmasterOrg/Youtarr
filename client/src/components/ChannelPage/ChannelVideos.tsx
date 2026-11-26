import React, { useState, useEffect } from 'react';
import { Card } from '../ui';
import {
  Download as DownloadIcon,
  Trash2 as DeleteIcon,
  Ban as BlockIcon,
} from '../../lib/icons';
import useMediaQuery from '../../hooks/useMediaQuery';
import { ChannelVideo } from '../../types/ChannelVideo';
import VideoModal from '../shared/VideoModal';
import {
  VideoListContainer,
  VideoListPaginationBar,
  useVideoListState,
  type SelectionAction,
  type VideoListViewMode,
} from '../shared/VideoList';
import ChannelVideosDialogs from './ChannelVideosDialogs';
import DownloadAllVideosDialog from './DownloadAllVideosDialog';
import ChannelVideosContent from './components/ChannelVideosContent';
import ChannelVideosHeader from './components/ChannelVideosHeader';
import ChannelVideosLoadingSkeleton from './components/ChannelVideosLoadingSkeleton';
import ChannelVideosSelectButtons from './components/ChannelVideosSelectButtons';
import ChannelVideosTabs from './components/ChannelVideosTabs';
import InfiniteScrollSentinel from './components/InfiniteScrollSentinel';
import { channelVideoToModalData } from './channelVideoModalData';
import { useChannelSelectionPill } from './hooks/useChannelVideoSelection';
import { useChannelVideosController } from './hooks/useChannelVideosController';
import { getTabLabel } from '../../utils/channelTabs';

interface ChannelVideosProps {
  token: string | null;
  channelAutoDownloadTabs?: string;
  channelId?: string;
  channelName?: string;
  channelVideoQuality?: string | null;
  channelAudioFormat?: string | null;
  channelAvailableTabs?: string | null;
  onVideosLoaded?: (channelId: string) => void;
}

const VIEW_MODE_STORAGE_KEY = 'youtarr:channelVideosViewMode';
const MOBILE_VIEW_MODES: VideoListViewMode[] = ['grid', 'list'];
const DESKTOP_VIEW_MODES: VideoListViewMode[] = ['grid', 'table'];

function ChannelVideos({
  token,
  channelAutoDownloadTabs,
  channelName = '',
  ...channelProps
}: ChannelVideosProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const listState = useVideoListState({
    initialViewMode: isMobile ? 'list' : 'table',
    viewModeStorageKey: VIEW_MODE_STORAGE_KEY,
  });
  const { viewMode, setViewMode } = listState;

  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);
  const [modalVideo, setModalVideo] = useState<ChannelVideo | null>(null);

  const {
    channelId,
    useInfiniteScroll,
    availableTabs,
    selectedTab,
    changeTab,
    query,
    videos,
    displayedVideos,
    totalCount,
    totalPages,
    hasNextPage,
    oldestVideoDate,
    loading,
    fetchError,
    refetchVideos,
    tabStats,
    selectedTabStats,
    overrides,
    selection,
    rowActions,
    bulkActions,
    listing,
    newVideosNotice,
    loadMoreRef,
    downloadDefaults,
    successMessage,
    errorMessage,
    clearSuccessMessage,
    clearErrorMessage,
  } = useChannelVideosController({ token, ...channelProps, search: listState.search });

  const downloadActions: SelectionAction<string>[] = [
    {
      id: 'download',
      label: 'Download',
      icon: <DownloadIcon size={14} />,
      intent: 'success',
      onClick: bulkActions.openDownloadDialog,
    },
    {
      id: 'ignore',
      label: 'Ignore',
      icon: <BlockIcon size={14} />,
      intent: 'warning',
      onClick: () => bulkActions.ignoreSelected(),
    },
  ];
  const deleteActions: SelectionAction<string>[] = [
    {
      id: 'delete',
      label: 'Delete',
      icon: <DeleteIcon size={14} />,
      intent: 'danger',
      disabled: () => bulkActions.deleteLoading,
      onClick: () => bulkActions.requestDelete(),
    },
  ];
  const activeSelection = useChannelSelectionPill(selection, downloadActions, deleteActions);

  const availableViewModes = isMobile ? MOBILE_VIEW_MODES : DESKTOP_VIEW_MODES;
  useEffect(() => {
    const viewModes = isMobile ? MOBILE_VIEW_MODES : DESKTOP_VIEW_MODES;
    if (!viewModes.includes(viewMode)) {
      setViewMode(isMobile ? 'list' : 'table');
    }
  }, [isMobile, viewMode, setViewMode]);

  const tabLabel = getTabLabel(selectedTab || 'videos');

  const renderPaginationBar = (placement: 'top' | 'bottom') => (
    <VideoListPaginationBar
      placement={placement}
      hasContent={totalCount > 0}
      useInfiniteScroll={useInfiniteScroll}
      page={query.page}
      totalPages={totalPages}
      onPageChange={query.setPage}
      pageSize={query.pageSize}
      onPageSizeChange={query.changePageSize}
      isMobile={isMobile}
    />
  );

  return (
    <>
      {/* Scroll target for the top of the list; the margin keeps it clear of the fixed app header. */}
      <div ref={newVideosNotice.listTopRef} style={{ scrollMarginTop: 'var(--app-shell-overlay-top-offset, 0px)' }} />
      <Card
        elevation={3}
        style={{ marginBottom: 16, borderRadius: 'var(--radius-ui)', overflow: 'hidden' }}
      >
        <VideoListContainer
          state={listState}
          selection={activeSelection}
          viewModes={availableViewModes}
          filters={query.filterConfigs}
          searchPlaceholder="Search videos..."
          headerSlot={
            <ChannelVideosHeader
              isMobile={isMobile}
              selectedTab={selectedTab}
              videos={videos}
              totalCount={totalCount}
              isFiltered={query.isFiltered}
              oldestVideoDate={oldestVideoDate}
              tabStats={tabStats}
              isFetching={listing.isFetching}
              showLoadMoreProgress={listing.showLoadMoreProgress}
              fetchProgress={listing.fetchProgress}
              onDownloadAll={listing.openDownloadAll}
              onLoadMore={listing.requestLoadMore}
              checkingForNewVideos={newVideosNotice.checking}
              newVideoCount={newVideosNotice.newCount}
              onShowNewVideos={newVideosNotice.show}
              onDismissNewVideos={newVideosNotice.dismiss}
              raiseNewVideosNotice={Boolean(isMobile && activeSelection?.hasSelection)}
            />
          }
          toolbarRightActions={
            isMobile ? null : (
              <ChannelVideosSelectButtons
                canSelectPending={selection.canSelectNotDownloaded}
                canSelectDownloaded={selection.canSelectDownloaded}
                onSelectPending={selection.selectAllNotDownloaded}
                onSelectDownloaded={selection.selectAllDownloaded}
              />
            )
          }
          tabsSlot={
            availableTabs.length > 0 ? (
              <ChannelVideosTabs
                availableTabs={availableTabs}
                selectedTab={selectedTab}
                autoDownloadTabs={channelAutoDownloadTabs}
                tabStats={tabStats}
                isMobile={isMobile}
                onChange={changeTab}
              />
            ) : null
          }
          itemCount={displayedVideos.length}
          isLoading={loading}
          isError={Boolean(fetchError)}
          errorMessage={fetchError ? 'Failed to fetch channel videos. Please try again later.' : undefined}
          renderContent={(mode) => (
            <ChannelVideosContent
              viewMode={mode}
              videos={displayedVideos}
              isMobile={isMobile}
              selection={selection}
              sortBy={query.sortBy}
              sortOrder={query.sortOrder}
              onSortChange={query.changeSort}
              onToggleIgnore={rowActions.toggleIgnore}
              onToggleProtection={rowActions.toggleProtection}
              onMobileTooltip={setMobileTooltip}
              onVideoClick={setModalVideo}
            />
          )}
          loadingSkeleton={
            loading && videos.length === 0 ? (
              <ChannelVideosLoadingSkeleton count={query.effectivePageSize} />
            ) : undefined
          }
          pagination={renderPaginationBar('bottom')}
          paginationTop={renderPaginationBar('top')}
          paginationMode={useInfiniteScroll ? 'infinite' : 'pages'}
          infiniteScrollSentinel={
            useInfiniteScroll ? (
              <InfiniteScrollSentinel
                sentinelRef={loadMoreRef}
                loadingMore={loading && videos.length > 0}
                caughtUp={!hasNextPage && videos.length > 0 && !fetchError && !loading}
                loadFailed={Boolean(fetchError) && videos.length > 0}
                onRetry={() => void refetchVideos()}
              />
            ) : null
          }
          isMobile={isMobile}
        />
      </Card>

      <ChannelVideosDialogs
        token={token}
        downloadDialogOpen={bulkActions.downloadDialogOpen}
        refreshConfirmOpen={listing.loadMoreConfirmOpen}
        deleteDialogOpen={bulkActions.deleteDialogOpen}
        fetchAllError={listing.loadMoreError}
        mobileTooltip={mobileTooltip}
        successMessage={successMessage}
        errorMessage={errorMessage}
        videoCount={selection.checkedBoxes.length}
        missingVideoCount={selection.missingVideoCount}
        selectedForDeletion={selection.selectedForDeletion.length}
        {...downloadDefaults}
        selectedTab={selectedTab || 'videos'}
        tabLabel={tabLabel}
        tabStats={selectedTabStats}
        onDownloadDialogClose={bulkActions.closeDownloadDialog}
        onDownloadConfirm={bulkActions.confirmDownload}
        onRefreshCancel={listing.cancelLoadMore}
        onRefreshConfirm={listing.confirmLoadMore}
        onDeleteCancel={bulkActions.cancelDelete}
        onDeleteConfirm={bulkActions.confirmDelete}
        onFetchAllErrorClose={listing.clearLoadMoreError}
        onMobileTooltipClose={() => setMobileTooltip(null)}
        onSuccessMessageClose={clearSuccessMessage}
        onErrorMessageClose={clearErrorMessage}
      />

      <DownloadAllVideosDialog
        open={listing.downloadAllOpen}
        onClose={listing.closeDownloadAll}
        channelId={channelId}
        token={token}
        tabType={selectedTab || 'videos'}
        tabLabel={tabLabel}
        {...downloadDefaults}
        runMetadataFetch={listing.runMetadataFetch}
        onStarted={listing.onDownloadAllStarted}
      />

      {modalVideo && (
        <VideoModal
          open
          onClose={() => setModalVideo(null)}
          video={channelVideoToModalData(modalVideo, channelName, channelId)}
          token={token}
          onVideoDeleted={() => {
            setModalVideo(null);
            refetchVideos();
          }}
          onProtectionChanged={overrides.setProtected}
          onIgnoreChanged={(youtubeId, isIgnored) => overrides.setIgnored({ [youtubeId]: isIgnored })}
          onDownloadQueued={() => setModalVideo(null)}
          onRatingChanged={() => refetchVideos()}
          onAvailabilityDetected={overrides.setAvailability}
          onPublishedDateDetected={overrides.setPublishedAt}
        />
      )}
    </>
  );
}

export default ChannelVideos;
