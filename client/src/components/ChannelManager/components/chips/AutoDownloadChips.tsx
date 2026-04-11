import React, { useState } from 'react';
import { Box, Chip, IconButton, Popover, Typography } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Chip
          label={isMobile ? 'Videos' : 'Videos (default)'}
          size="small"
          variant={willAutoDownload ? 'filled' : 'outlined'}
          color={willAutoDownload ? 'primary' : 'default'}
          icon={willAutoDownload ? <FileDownloadIcon sx={{ fontSize: '0.85rem' }} /> : undefined}
          sx={{ fontSize: '0.7rem', opacity: willAutoDownload ? 1 : 0.7 }}
        />
        <IconButton
          size="small"
          onClick={(e) => setInfoAnchor(e.currentTarget)}
          sx={{ p: 0.25 }}
        >
          <InfoOutlinedIcon sx={{ fontSize: '0.9rem', opacity: 0.6 }} />
        </IconButton>
        <Popover
          open={Boolean(infoAnchor)}
          anchorEl={infoAnchor}
          onClose={() => setInfoAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <Typography variant="body2" sx={{ p: 2, maxWidth: 300 }}>
            Available tabs (Videos, Shorts, Streams) have not been detected for this
            channel yet. They will be automatically detected when you visit the channel
            page.
          </Typography>
        </Popover>
      </Box>
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
