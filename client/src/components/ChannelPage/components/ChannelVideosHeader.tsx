import React from 'react';
import { Button, Chip, Typography } from '../../ui';
import { Download as DownloadIcon, RefreshCw as RefreshIcon } from '../../../lib/icons';
import { intentStyles } from '../../../utils/intentStyles';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { ChannelTabType, TabDownloadStatsByTab } from '../../../types/Channel';
import { FetchProgress } from '../hooks/useChannelFetchStatus';
import { getTabLabel } from '../../../utils/channelTabs';
import TabDownloadSummary from './TabDownloadSummary';
import ChannelVideosInfo from './ChannelVideosInfo';
import LoadMoreProgress from './LoadMoreProgress';
import NewVideosNotice from './NewVideosNotice';

const DATE_INFO =
  'Dates come from YouTube. A ~ marks an estimate (YouTube said something like "1 month ago"); ' +
  'it becomes exact once the video is downloaded or opened. If the order looks off, Load More rebuilds it.';
const PENDING_DATES_INFO = 'Pending means YouTube listed the video without a date. ';
const SHORTS_DATE_INFO = "YouTube doesn't provide publish dates for Shorts.";

interface ChannelVideosHeaderProps {
  isMobile: boolean;
  selectedTab: string | null;
  // The loaded rows of the selected tab.
  videos: ChannelVideo[];
  totalCount: number;
  // A search or filter is narrowing the list.
  isFiltered: boolean;
  oldestVideoDate: string | null;
  tabStats: TabDownloadStatsByTab | null;
  // Any fetch of the tab is running; it blocks both buttons.
  isFetching: boolean;
  showLoadMoreProgress: boolean;
  fetchProgress: FetchProgress | null;
  onDownloadAll: () => void;
  onLoadMore: () => void;
  checkingForNewVideos: boolean;
  newVideoCount: number;
  onShowNewVideos: () => void;
  onDismissNewVideos: () => void;
  // Lift the new videos bar above the selection bar at the bottom of the screen.
  raiseNewVideosNotice: boolean;
}

function ChannelVideosHeader({
  isMobile,
  selectedTab,
  videos,
  totalCount,
  isFiltered,
  oldestVideoDate,
  tabStats,
  isFetching,
  showLoadMoreProgress,
  fetchProgress,
  onDownloadAll,
  onLoadMore,
  checkingForNewVideos,
  newVideoCount,
  onShowNewVideos,
  onDismissNewVideos,
  raiseNewVideosNotice,
}: ChannelVideosHeaderProps) {
  const selectedTabStats = selectedTab ? tabStats?.[selectedTab as ChannelTabType] : undefined;
  const showsTabSummary = Boolean(
    selectedTabStats && selectedTabStats.total !== null && selectedTabStats.loaded !== undefined
  );
  // The summary already gives the tab's size; the list count only adds
  // something while a search or filter narrows the list.
  let countChipLabel: string | null = null;
  if (totalCount > 0 && isFiltered) {
    countChipLabel = `${totalCount} ${totalCount === 1 ? 'match' : 'matches'}`;
  } else if (totalCount > 0 && !showsTabSummary) {
    countChipLabel = `${totalCount} ${totalCount === 1 ? 'item' : 'items'}`;
  }

  const hasPendingDates = videos.some(
    (v) => v.published_at_source === 'estimated' && v.media_type !== 'short'
  );
  const dateInfo =
    selectedTab === 'shorts'
      ? SHORTS_DATE_INFO
      : (hasPendingDates ? PENDING_DATES_INFO : '') + DATE_INFO;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px 8px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
        data-testid="channel-videos-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {countChipLabel && (
            <Chip label={countChipLabel} size="small" color="primary" />
          )}
          <TabDownloadSummary tabLabel={getTabLabel(selectedTab || 'videos')} stats={selectedTabStats} />
          {oldestVideoDate && selectedTab !== 'shorts' && !isMobile && (
            <Typography variant="caption" color="text.secondary">
              Oldest: {new Date(oldestVideoDate).toLocaleDateString()}
            </Typography>
          )}
          <ChannelVideosInfo tabStats={tabStats} dateText={dateInfo} highlight={hasPendingDates} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button
            onClick={onDownloadAll}
            variant="outlined"
            size="small"
            color="inherit"
            disabled={isFetching}
            startIcon={<DownloadIcon size={16} />}
            className={intentStyles.base}
            data-testid="channel-download-all-button"
          >
            Download All
          </Button>
          <Button
            onClick={onLoadMore}
            variant="outlined"
            size="small"
            color="inherit"
            disabled={isFetching}
            startIcon={<RefreshIcon size={16} />}
            className={intentStyles.base}
            data-testid="channel-refresh-button"
          >
            {showLoadMoreProgress ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      </div>
      {showLoadMoreProgress && <LoadMoreProgress progress={fetchProgress} total={selectedTabStats?.total} />}
      <NewVideosNotice
        checking={checkingForNewVideos}
        newCount={newVideoCount}
        onShow={onShowNewVideos}
        onDismiss={onDismissNewVideos}
        raised={raiseNewVideosNotice}
      />
    </div>
  );
}

export default ChannelVideosHeader;
