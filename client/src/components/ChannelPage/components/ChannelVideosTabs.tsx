import React from 'react';
import { Tab, Tabs, Typography } from '../../ui';
import { ChannelTabType, TabDownloadStatsByTab } from '../../../types/Channel';
import { getTabLabel, getTabMediaType } from '../../../utils/channelTabs';
import TabDownloadProgress from './TabDownloadProgress';

interface ChannelVideosTabsProps {
  availableTabs: string[];
  selectedTab: string | null;
  // The channel's auto-download setting: comma separated media types.
  autoDownloadTabs?: string;
  tabStats: TabDownloadStatsByTab | null;
  isMobile: boolean;
  onChange: (event: React.SyntheticEvent, newTab: string | number) => void;
}

function ChannelVideosTabs({
  availableTabs,
  selectedTab,
  autoDownloadTabs,
  tabStats,
  isMobile,
  onChange,
}: ChannelVideosTabsProps) {
  const autoDownloadMediaTypes = autoDownloadTabs
    ? autoDownloadTabs.split(',').map((mediaType) => mediaType.trim())
    : [];

  const renderTabLabel = (tabType: string) => {
    const label = getTabLabel(tabType);
    const mediaType = getTabMediaType(tabType);
    const autoDownloads = mediaType !== undefined && autoDownloadMediaTypes.includes(mediaType);
    return (
      <div className="flex flex-col items-center gap-1">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Typography variant="caption" style={{ fontWeight: 700, color: 'inherit' }}>
            {label}
          </Typography>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: autoDownloads ? 'var(--success)' : 'rgba(0,0,0,0.08)',
              border: autoDownloads ? '2px solid var(--success)' : '1px solid rgba(0,0,0,0.25)',
              transition: 'all 200ms ease',
              display: 'inline-block',
              boxShadow: autoDownloads ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
            }}
            title={autoDownloads ? 'Auto-download enabled' : 'Auto-download disabled'}
          />
        </div>
        <TabDownloadProgress label={label} stats={tabStats?.[tabType as ChannelTabType]} />
      </div>
    );
  };

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        padding: isMobile ? '0 10px' : '0 16px',
      }}
    >
      <Tabs
        value={selectedTab || 'videos'}
        onChange={onChange}
        variant={isMobile ? 'fullWidth' : 'standard'}
        centered={!isMobile}
        aria-label="channel video tabs"
      >
        {availableTabs.map((tab) => (
          <Tab key={tab} label={renderTabLabel(tab)} value={tab} />
        ))}
      </Tabs>
    </div>
  );
}

export default ChannelVideosTabs;
