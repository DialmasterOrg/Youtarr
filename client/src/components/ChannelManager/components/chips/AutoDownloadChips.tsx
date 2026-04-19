import React, { useState } from 'react';
import { Chip, IconButton, Popover, Typography } from '../../../../components/ui';
import { FileDownload as FileDownloadIcon, Info as InfoOutlinedIcon } from '../../../../lib/icons';
import { SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE, SHARED_CHIP_RADIUS } from '../../../shared/chipStyles';

interface AutoDownloadChipsProps {
  availableTabs: string | null | undefined;
  autoDownloadTabs: string | undefined;
  isMobile: boolean;
}

const AutoDownloadChips: React.FC<AutoDownloadChipsProps> = ({
  availableTabs,
  autoDownloadTabs,
  isMobile,
}) => {
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);

  const availableToMediaTypeMap: Record<string, string> = {
    videos: 'video',
    shorts: 'short',
    streams: 'livestream',
  };

  const tabDisplayMap: Record<string, { full: string; short: string }> = {
    videos: { full: 'Videos', short: 'Videos' },
    shorts: { full: 'Shorts', short: 'Shorts' },
    streams: { full: 'Live', short: 'Live' },
  };

  const available = availableTabs
    ? availableTabs.split(',').map((tab) => tab.trim()).filter((tab) => tab.length > 0)
    : [];

  const autoDownloadEnabled = autoDownloadTabs
    ? autoDownloadTabs.split(',').map((tab) => tab.trim()).filter((tab) => tab.length > 0)
    : [];

  // When tabs haven't been detected yet (e.g. newly imported channels),
  // show a default indicator with an info icon instead of blank space.
  // Reflect whether auto-download is actually enabled based on autoDownloadTabs.
  if (available.length === 0) {
    const willAutoDownload = autoDownloadEnabled.length > 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Chip
          label={isMobile ? 'Videos' : 'Videos (default)'}
          size="small"
          variant={willAutoDownload ? 'filled' : 'outlined'}
          color={willAutoDownload ? 'primary' : 'default'}
          icon={willAutoDownload ? <FileDownloadIcon size={12} /> : undefined}
          style={{
            fontSize: '0.7rem',
            height: 24,
            borderRadius: SHARED_CHIP_RADIUS,
            opacity: willAutoDownload ? 1 : 0.7,
            ...(willAutoDownload ? undefined : SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE),
          }}
        />
        <IconButton
          size="small"
          onClick={(e) => setInfoAnchor(e.currentTarget)}
          aria-label="Auto-download defaults info"
          style={{ padding: 2 }}
        >
          <InfoOutlinedIcon size={14} style={{ opacity: 0.65 }} />
        </IconButton>
        <Popover
          open={Boolean(infoAnchor)}
          anchorEl={infoAnchor}
          onClose={() => setInfoAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <div style={{ padding: 12, maxWidth: 300 }}>
            <Typography variant="body2">
              Available tabs (Videos, Shorts, Streams) have not been detected for this
              channel yet. They will be automatically detected when you visit the channel
              page.
            </Typography>
          </div>
        </Popover>
      </div>
    );
  }

  const chips = available
    .map((tab) => {
      const tabInfo = tabDisplayMap[tab];
      if (!tabInfo) return null;
      const mediaType = availableToMediaTypeMap[tab];
      const isAutoDownloadEnabled = mediaType && autoDownloadEnabled.includes(mediaType);

      return (
        <Chip
          key={tab}
          data-testid={`auto-download-chip-${tab}`}
          data-autodownload={isAutoDownloadEnabled ? 'true' : 'false'}
          label={isMobile ? tabInfo.short : tabInfo.full}
          size="small"
          variant="filled"
          color={isAutoDownloadEnabled ? 'primary' : 'default'}
          icon={isAutoDownloadEnabled ? <FileDownloadIcon size={12} /> : undefined}
          style={{
            fontSize: '0.7rem',
            height: 24,
            lineHeight: '14px',
            minWidth: isMobile ? 56 : 64,
            borderRadius: SHARED_CHIP_RADIUS,
            ...(isAutoDownloadEnabled ? undefined : SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE),
            opacity: isAutoDownloadEnabled ? 1 : 0.8,
          }}
        />
      );
    })
    .filter(Boolean) as React.ReactNode[];

  if (chips.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {chips}
    </div>
  );
};

export default AutoDownloadChips;
