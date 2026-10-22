import React from 'react';
import { Chip, IconButton } from '../../ui';
import {
  CalendarToday as CalendarTodayIcon,
  Download as DownloadIcon,
  Eye as EyeIcon,
} from '../../../lib/icons';
import ChannelNameDisplay from '../../shared/ChannelNameDisplay';
import {
  getStatusColor,
  getStatusIcon,
  getStatusLabel,
  getStatusChipVariant,
  getStatusChipStyle,
  VideoStatus,
} from '../../../utils/videoStatus';
import { SHARED_THEMED_CHIP_SMALL_STYLE } from '../../shared/chipStyles';
import { formatCompactCount, formatRelativeDate } from '../../../utils/formatters';
import { isSelectableForDownload, isShort, SearchResult } from '../types';

export type AddChannelHandler = (channelName: string, channelUrl: string) => void;

const noopAddChannel: AddChannelHandler = () => {};

// Nearly every search result is new, so "Not Downloaded" is the silent default
// and only the states worth noticing get a chip.
export function ResultStatusChip({ status }: { status: VideoStatus }) {
  if (status === 'never_downloaded') return null;
  return (
    <Chip
      icon={getStatusIcon(status)}
      label={getStatusLabel(status)}
      size="small"
      color={getStatusColor(status)}
      variant={getStatusChipVariant(status)}
      className="shrink-0"
      style={{ ...SHARED_THEMED_CHIP_SMALL_STYLE, ...getStatusChipStyle(status) }}
    />
  );
}

interface ResultChannelProps {
  result: SearchResult;
  variant: 'caption' | 'body2';
  className?: string;
  style?: React.CSSProperties;
  onAddChannel?: AddChannelHandler;
}

export function ResultChannel({ result, variant, className, style, onAddChannel }: ResultChannelProps) {
  const subscribed = Boolean(result.channelSubscribed && result.channelId);
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <ChannelNameDisplay
        channelName={result.channelName}
        enabledChannelId={subscribed ? result.channelId : null}
        videoChannelId={onAddChannel ? result.channelId : null}
        variant={variant}
        className={className}
        style={style}
        onAddChannel={onAddChannel ?? noopAddChannel}
      />
      {subscribed && (
        <Chip
          label="Subscribed"
          size="small"
          variant="outlined"
          className="shrink-0"
          style={SHARED_THEMED_CHIP_SMALL_STYLE}
        />
      )}
    </span>
  );
}

interface PublishedDateProps {
  publishedAt: string | null;
  iconSize?: number;
  fallback?: React.ReactNode;
  className?: string;
}

// Relative, like YouTube: the yt-dlp path's dates come from "5 years ago"
// text, so an exact-looking date would claim precision the data lacks.
export function PublishedDate({ publishedAt, iconSize = 12, fallback = null, className = '' }: PublishedDateProps) {
  const relative = formatRelativeDate(publishedAt);
  if (!relative || !publishedAt) return <>{fallback}</>;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}
      title={new Date(publishedAt).toLocaleDateString()}
    >
      <CalendarTodayIcon size={iconSize} aria-hidden />
      {relative}
    </span>
  );
}

interface ViewCountProps {
  viewCount: number | null | undefined;
  iconSize?: number;
  icon?: boolean;
  className?: string;
}

export function ViewCount({ viewCount, iconSize = 12, icon = true, className = '' }: ViewCountProps) {
  if (viewCount === null || viewCount === undefined) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}
      title={`${viewCount.toLocaleString()} views`}
    >
      {icon && <EyeIcon size={iconSize} aria-hidden />}
      {formatCompactCount(viewCount)}
    </span>
  );
}

export function ShortBadge({ duration }: { duration: number | null }) {
  if (!isShort(duration)) return null;
  return (
    <Chip
      label="Short"
      size="small"
      variant="outlined"
      className="shrink-0"
      title="A minute or less"
      style={SHARED_THEMED_CHIP_SMALL_STYLE}
    />
  );
}

interface DownloadButtonProps {
  result: SearchResult;
  onDownload: (result: SearchResult) => void;
  className?: string;
}

export function DownloadButton({ result, onDownload, className }: DownloadButtonProps) {
  if (!isSelectableForDownload(result.status)) return null;
  return (
    <IconButton
      size="sm"
      aria-label={`Download ${result.title}`}
      title="Download"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onDownload(result);
      }}
    >
      <DownloadIcon size={16} />
    </IconButton>
  );
}
