import React from 'react';
import { Typography } from '../../ui';
import { TabDownloadStats } from '../../../types/Channel';

// Mirrors MAX_LOAD_MORE_VIDEOS in server/modules/channel/channelVideosService.js.
export const LOAD_MORE_MAX_VIDEOS = 5000;

interface TabDownloadSummaryProps {
  tabLabel: string;
  stats: TabDownloadStats | undefined;
}

// The selected tab's counts in one line; the header's info button explains them.
const TabDownloadSummary: React.FC<TabDownloadSummaryProps> = ({ tabLabel, stats }) => {
  if (!stats || stats.total === null || stats.loaded === undefined) return null;

  const limitNote = stats.total > LOAD_MORE_MAX_VIDEOS
    ? ` (Load More loads up to ${LOAD_MORE_MAX_VIDEOS.toLocaleString()})`
    : '';
  return (
    <Typography variant="caption" color="text.secondary" data-testid="tab-download-summary">
      <span className="font-semibold text-foreground">
        {tabLabel}
        <span className="hidden md:inline"> tab</span>
      </span>
      {` · ${stats.downloaded.toLocaleString()} of ${stats.total.toLocaleString()} downloaded`}
      {` · ${stats.loaded.toLocaleString()} loaded${limitNote}`}
    </Typography>
  );
};

export default TabDownloadSummary;
