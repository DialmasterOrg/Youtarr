import React from 'react';
import { TabDownloadStats } from '../../../types/Channel';
import { describeTabCounts } from '../../../utils/tabDownloadStats';

// Keeps a tab with a few downloads out of thousands from looking empty.
const MIN_VISIBLE_FILL_PERCENT = 3;

interface TabDownloadProgressProps {
  label: string;
  stats: TabDownloadStats | undefined;
}

// A thin bar under the tab label reads as download progress without a legend;
// the counts beside it only fit on wider screens.
const TabDownloadProgress: React.FC<TabDownloadProgressProps> = ({ label, stats }) => {
  if (!stats || stats.total === null || stats.percent === null) return null;

  const fill = stats.downloaded > 0 ? Math.max(stats.percent, MIN_VISIBLE_FILL_PERCENT) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div
        role="progressbar"
        aria-label={`${label}: ${describeTabCounts({ ...stats, loaded: undefined })}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={stats.percent}
        className="h-1 w-12 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary" style={{ width: `${fill}%` }} />
      </div>
      <span className="hidden text-[0.7rem] font-normal text-muted-foreground md:inline">
        {`${stats.downloaded.toLocaleString()}/${stats.total.toLocaleString()}`}
      </span>
    </div>
  );
};

export default TabDownloadProgress;
