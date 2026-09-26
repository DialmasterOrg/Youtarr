import React from 'react';
import { Typography } from '../../ui';
import InfoPopoverButton from '../../shared/InfoPopoverButton';
import { ChannelTabType, TabDownloadStats, TabDownloadStatsByTab } from '../../../types/Channel';
import { describeTabCounts, PUBLIC_ONLY_NOTE } from '../../../utils/tabDownloadStats';
import { formatDateTime } from '../../../utils/formatters';

const TAB_LABELS: Record<ChannelTabType, string> = {
  videos: 'Videos',
  shorts: 'Shorts',
  streams: 'Live',
};

interface ChannelVideosInfoProps {
  tabStats: TabDownloadStatsByTab | null;
  dateText: string;
  // Tints the icon when some publish dates are still pending.
  highlight: boolean;
}

// The one explanation for the channel videos header: download progress per
// tab and how publish dates work.
const ChannelVideosInfo: React.FC<ChannelVideosInfoProps> = ({ tabStats, dateText, highlight }) => {
  const countedTabs = (Object.keys(TAB_LABELS) as ChannelTabType[])
    .map((tab) => ({ tab, stats: tabStats?.[tab] }))
    .filter((entry): entry is { tab: ChannelTabType; stats: TabDownloadStats } =>
      Boolean(entry.stats) && entry.stats?.total !== null);
  // The oldest count, so a tab whose lookup failed never looks fresher than it is.
  const oldestFetchedAt = countedTabs
    .map(({ stats }) => stats.fetchedAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  const updatedText = formatDateTime(oldestFetchedAt);

  return (
    <InfoPopoverButton ariaLabel="Video list info" color={highlight ? 'var(--warning)' : undefined}>
      <div className="flex flex-col gap-3">
        {countedTabs.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <Typography variant="subtitle2">Downloads</Typography>
              {updatedText && (
                <Typography variant="caption" color="text.secondary">{`Updated ${updatedText}`}</Typography>
              )}
            </div>
            {countedTabs.map(({ tab, stats }) => (
              <Typography key={tab} variant="body2">
                {`${TAB_LABELS[tab]}: ${describeTabCounts(stats)}`}
              </Typography>
            ))}
            <Typography variant="body2" color="text.secondary">{PUBLIC_ONLY_NOTE}</Typography>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Typography variant="subtitle2">Publish dates</Typography>
          <Typography variant="body2">{dateText}</Typography>
        </div>
      </div>
    </InfoPopoverButton>
  );
};

export default ChannelVideosInfo;
