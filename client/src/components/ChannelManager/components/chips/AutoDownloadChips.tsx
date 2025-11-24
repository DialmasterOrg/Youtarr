import React from 'react';
import { Box, Chip } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

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

  if (available.length === 0) {
    return null;
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
          variant={isAutoDownloadEnabled ? 'filled' : 'outlined'}
          color={isAutoDownloadEnabled ? 'primary' : 'default'}
          icon={isAutoDownloadEnabled ? <FileDownloadIcon sx={{ fontSize: '0.85rem' }} /> : undefined}
          sx={{
            fontSize: '0.7rem',
            '& .MuiChip-icon': {
              ml: 0.3,
            },
          }}
        />
      );
    })
    .filter(Boolean) as React.ReactNode[];

  if (chips.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {chips}
    </Box>
  );
};

export default AutoDownloadChips;
