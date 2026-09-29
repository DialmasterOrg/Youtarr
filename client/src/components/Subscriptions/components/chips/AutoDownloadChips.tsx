import React, { useState } from 'react';
import { Chip, IconButton, Popover, Tooltip, Typography } from '../../../../components/ui';
import { Circle as CircleIcon } from 'lucide-react';
import { CheckCircle as CheckCircleIcon, FileDownload as FileDownloadIcon, Info as InfoOutlinedIcon } from '../../../../lib/icons';
import { SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE, SHARED_CHIP_RADIUS } from '../../../shared/chipStyles';
import { ChannelTabType, TabDownloadStatsByTab } from '../../../../types/Channel';
import { describeTabStats, formatTabPercent } from '../../../../utils/tabDownloadStats';

// On mobile the toggles share the row equally and grow to a comfortable tap height.
const MOBILE_TOGGLE_CHIP_STYLE: React.CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  height: 32,
  fontSize: '0.75rem',
};

interface AutoDownloadChipsProps {
  availableTabs: string | null | undefined;
  autoDownloadTabs: string | undefined;
  isMobile: boolean;
  tabStats?: TabDownloadStatsByTab;
  // When set, each chip becomes a toggle button for that tab's auto-download.
  onToggle?: (tab: string, enabled: boolean) => void;
  // Blocks toggles while a save runs. The chip's inline opacity overrides the
  // disabled fade, so a quick save doesn't flash the row.
  toggleDisabled?: boolean;
}

const AutoDownloadChips: React.FC<AutoDownloadChipsProps> = ({
  availableTabs,
  autoDownloadTabs,
  isMobile,
  tabStats,
  onToggle,
  toggleDisabled = false,
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

  const mobileToggleRow = Boolean(onToggle) && isMobile;

  const chips = available
    .map((tab) => {
      const tabInfo = tabDisplayMap[tab];
      if (!tabInfo) return null;
      const mediaType = availableToMediaTypeMap[tab];
      const isAutoDownloadEnabled = mediaType && autoDownloadEnabled.includes(mediaType);
      const stats = tabStats?.[tab as ChannelTabType];
      const percentText = formatTabPercent(stats);
      const baseLabel = isMobile ? tabInfo.short : tabInfo.full;
      const isToggle = Boolean(onToggle);

      let icon: React.ReactNode = isAutoDownloadEnabled ? <FileDownloadIcon size={12} /> : undefined;
      if (isToggle) {
        icon = isAutoDownloadEnabled ? <CheckCircleIcon size={12} /> : <CircleIcon size={12} />;
      }

      const chip = (
        <Chip
          key={tab}
          data-testid={`auto-download-chip-${tab}`}
          data-autodownload={isAutoDownloadEnabled ? 'true' : 'false'}
          label={percentText ? `${baseLabel} ${percentText}` : baseLabel}
          size="small"
          variant="filled"
          color={isAutoDownloadEnabled ? 'primary' : 'default'}
          icon={icon}
          onClick={onToggle ? () => onToggle(tab, !isAutoDownloadEnabled) : undefined}
          disabled={isToggle ? toggleDisabled : undefined}
          aria-pressed={isToggle ? Boolean(isAutoDownloadEnabled) : undefined}
          aria-label={isToggle ? `Auto-download ${tabInfo.full}` : undefined}
          className={isToggle ? 'hover:ring-1 hover:ring-ring' : undefined}
          style={{
            fontSize: '0.7rem',
            height: 24,
            lineHeight: '14px',
            minWidth: isMobile ? 56 : 64,
            borderRadius: SHARED_CHIP_RADIUS,
            ...(isAutoDownloadEnabled ? undefined : SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE),
            opacity: isAutoDownloadEnabled ? 1 : 0.8,
            ...(mobileToggleRow ? MOBILE_TOGGLE_CHIP_STYLE : undefined),
          }}
        />
      );
      const statsText = stats ? describeTabStats(stats) : null;
      // Touch screens never show hover tooltips, and the tooltip's wrapper would
      // keep the chips from sharing the row equally.
      if (mobileToggleRow) {
        return chip;
      }
      if (!isToggle) {
        return statsText ? (
          <Tooltip key={tab} title={statsText}>
            {chip}
          </Tooltip>
        ) : chip;
      }
      const toggleHint = isAutoDownloadEnabled
        ? `Click to stop auto-downloading ${tabInfo.full}`
        : `Click to auto-download ${tabInfo.full}`;
      // Touch taps toggle directly; a tap-opened tooltip would only cover the chips.
      return (
        <Tooltip key={tab} title={statsText ? `${statsText}. ${toggleHint}` : toggleHint} disableTouchListener>
          {chip}
        </Tooltip>
      );
    })
    .filter(Boolean) as React.ReactNode[];

  if (chips.length === 0) {
    return null;
  }

  return (
    <div style={mobileToggleRow ? { display: 'flex', gap: 6, width: '100%' } : { display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {chips}
    </div>
  );
};

export default AutoDownloadChips;
