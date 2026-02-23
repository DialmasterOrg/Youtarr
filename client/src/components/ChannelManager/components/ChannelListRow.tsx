import React, { useState } from 'react';
import {
  Avatar,
  Chip,
  ListItem,
  Tooltip,
  Typography,
  Divider,
} from '../../ui';
import { Delete as DeleteIcon } from '../../../lib/icons';
import { Channel } from '../../../types/Channel';
import { SubFolderChip, QualityChip, AutoDownloadChips, DurationFilterChip, TitleFilterChip, DownloadFormatConfigIndicator } from './chips';
import RatingBadge from '../../shared/RatingBadge';

interface ChannelListRowProps {
  channel: Channel;
  isMobile: boolean;
  globalPreferredResolution: string;
  onNavigate: () => void;
  onDelete: () => void;
  onRegexClick: (event: React.MouseEvent<HTMLElement>, regex: string) => void;
  isPendingAddition?: boolean;
  rowIndex?: number;
}

export const CHANNEL_LIST_DESKTOP_TEMPLATE = 'minmax(260px, 1.6fr) repeat(3, minmax(140px, 1fr)) 56px';

const ChannelListRow: React.FC<ChannelListRowProps> = ({
  channel,
  isMobile,
  globalPreferredResolution,
  onNavigate,
  onDelete,
  onRegexClick,
  isPendingAddition,
  rowIndex,
}) => {
  const [thumbnailVisible, setThumbnailVisible] = useState(true);
  const hasFilters = channel.min_duration || channel.max_duration || channel.title_filter_regex;

  const thumbnailSrc = channel.channel_id
    ? `/images/channelthumb-${channel.channel_id}.jpg`
    : '/images/channelthumb-default.jpg';

  const renderChannelHeader = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: isPendingAddition ? 'not-allowed' : 'pointer',
      }}
      onClick={isPendingAddition ? undefined : onNavigate}
      data-testid={`channel-list-row-${channel.channel_id || channel.url}`}
    >
      {thumbnailVisible && (
        <Avatar
          src={thumbnailSrc}
          alt={`${channel.uploader} thumbnail`}
          style={{ width: 56, height: 56 }}
          imgProps={{ onError: () => setThumbnailVisible(false) }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 0 }}>
          <Typography variant={isMobile ? 'h6' : 'h5'} noWrap style={{ minWidth: 0 }}>
            {channel.uploader || 'Unknown Channel'}
          </Typography>
          {/* On mobile we show folder and quality chips right under the channel name */}
          {isMobile && (
            <div style={{ marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <QualityChip videoQuality={channel.video_quality} globalPreferredResolution={globalPreferredResolution} />
              <SubFolderChip subFolder={channel.sub_folder} />
              <RatingBadge rating={channel.default_rating} />
            </div>)}
        </div>
        {isPendingAddition && <Chip label="Pending addition" size="small" color="warning" style={{ marginTop: 4 }} />}
      </div>
    </div>
  );

  const zebraBackground = typeof rowIndex === 'number' && rowIndex % 2 === 1 ? 'var(--muted)' : undefined;

  if (isMobile) {
    return (
      <ListItem
        divider
        style={{
          flexDirection: 'column',
          alignItems: 'stretch',
          backgroundColor: isPendingAddition ? 'var(--muted)' : zebraBackground,
          border: isPendingAddition ? '1px dashed var(--warning)' : '1px solid transparent',
          gap: 8,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        <div style={{ display: 'flex', width: '100%', gap: 8 }}>
          <div style={{ flex: 1 }}>{renderChannelHeader()}</div>
          <Tooltip title="Remove channel">
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', display: 'inline-flex', alignItems: 'center', padding: 4 }}
              onClick={onDelete}
              aria-label="Remove channel"
            >
              <DeleteIcon size={20} />
            </button>
          </Tooltip>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <DownloadFormatConfigIndicator audioFormat={channel.audio_format} />
          <AutoDownloadChips
            availableTabs={channel.available_tabs}
            autoDownloadTabs={channel.auto_download_enabled_tabs}
            isMobile={isMobile}
          />
          {hasFilters && (
            <Divider
              orientation="vertical"
              flexItem
              style={{ alignSelf: 'stretch', marginLeft: 4, marginRight: 4 }}
              aria-hidden
            />
          )}
          <span style={{ display: 'inline-flex', gap: 4 }} data-testid="mobile-filter-chips">
            <DurationFilterChip
              minDuration={channel.min_duration}
              maxDuration={channel.max_duration}
              isMobile={isMobile}
            />
            <TitleFilterChip
              titleFilterRegex={channel.title_filter_regex}
              onRegexClick={onRegexClick}
              isMobile={isMobile}
            />
          </span>
        </div>
      </ListItem>
    );
  }

  return (
    <ListItem
      divider
      style={{
        flexDirection: 'column',
        alignItems: 'stretch',
        backgroundColor: isPendingAddition ? 'var(--muted)' : zebraBackground,
        borderLeft: isPendingAddition ? '4px solid var(--warning)' : '4px solid transparent',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: CHANNEL_LIST_DESKTOP_TEMPLATE,
          columnGap: 16,
          alignItems: 'center',
        }}
      >
        <div style={{ minWidth: 0, paddingRight: 8 }}>{renderChannelHeader()}</div>

        {/* Quality / Folder / Rating Column */}
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <QualityChip videoQuality={channel.video_quality} globalPreferredResolution={globalPreferredResolution} />
          <SubFolderChip subFolder={channel.sub_folder} />
          <RatingBadge rating={channel.default_rating} />
        </div>

        {/* Auto Downloads Column */}
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <DownloadFormatConfigIndicator audioFormat={channel.audio_format} />
          <AutoDownloadChips
            availableTabs={channel.available_tabs}
            autoDownloadTabs={channel.auto_download_enabled_tabs}
            isMobile={isMobile}
          />
        </div>

        {/* Filters Column */}
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <DurationFilterChip minDuration={channel.min_duration} maxDuration={channel.max_duration} isMobile={isMobile} />
          <TitleFilterChip titleFilterRegex={channel.title_filter_regex} onRegexClick={onRegexClick} isMobile={isMobile} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Tooltip title="Remove channel">
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', display: 'inline-flex', alignItems: 'center', padding: 4 }}
              onClick={onDelete}
              aria-label="Remove channel"
            >
              <DeleteIcon size={20} />
            </button>
          </Tooltip>
        </div>
      </div>
    </ListItem>
  );
};

export default ChannelListRow;
