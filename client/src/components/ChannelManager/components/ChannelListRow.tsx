import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  ListItem,
  Tooltip,
  Typography,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Channel } from '../../../types/Channel';
import { SubFolderChip, QualityChip, AutoDownloadChips, DurationFilterChip, TitleFilterChip, DownloadFormatConfigIndicator } from './chips';

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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        cursor: isPendingAddition ? 'not-allowed' : 'pointer',
      }}
      onClick={isPendingAddition ? undefined : onNavigate}
      data-testid={`channel-list-row-${channel.channel_id || channel.url}`}
    >
      {thumbnailVisible && (
        <Avatar
          src={thumbnailSrc}
          alt={`${channel.uploader} thumbnail`}
          sx={{ width: 56, height: 56 }}
          imgProps={{ onError: () => setThumbnailVisible(false) }}
        />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 0 }}>
          <Typography variant={isMobile ? 'h6' : 'h5'} noWrap sx={{ minWidth: 0 }}>
            {channel.uploader || 'Unknown Channel'}
          </Typography>
          {/* On mobile we show folder and quality chips right under the channel name */}
          {isMobile && (
            <Box sx={{ mt: 0.25, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <QualityChip videoQuality={channel.video_quality} globalPreferredResolution={globalPreferredResolution} />
              <SubFolderChip subFolder={channel.sub_folder} />
            </Box>)}
        </Box>
        {isPendingAddition && <Chip label="Pending addition" size="small" color="warning" sx={{ mt: 0.5 }} />}
      </Box>
    </Box>
  );

  const zebraBackground = typeof rowIndex === 'number' && rowIndex % 2 === 1 ? 'action.hover' : undefined;

  if (isMobile) {
    return (
      <ListItem
        divider
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          bgcolor: isPendingAddition ? 'action.hover' : zebraBackground,
          border: isPendingAddition ? (theme) => `1px dashed ${theme.palette.warning.main}` : '1px solid transparent',
          gap: 1,
          px: 1,
        }}
      >
        <Box sx={{ display: 'flex', width: '100%', gap: 1 }}>
          <Box sx={{ flex: 1 }}>{renderChannelHeader()}</Box>
          <Tooltip title="Remove channel">
            <IconButton color="error" onClick={onDelete} aria-label="Remove channel" size="small">
              <DeleteIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
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
              sx={{ alignSelf: 'stretch', mx: 0.5 }}
              aria-hidden
            />
          )}
          <Box
            component="span"
            sx={{ display: 'inline-flex', gap: 0.5 }}
            data-testid="mobile-filter-chips"
          >
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
          </Box>
        </Box>
      </ListItem>
    );
  }

  return (
    <ListItem
      divider
      sx={{
        flexDirection: 'column',
        alignItems: 'stretch',
        bgcolor: isPendingAddition ? 'action.hover' : zebraBackground,
        borderLeft: isPendingAddition ? (theme) => `4px solid ${theme.palette.warning.main}` : '4px solid transparent',
        px: { xs: 1, md: 2 },
        py: 1,
      }}
    >
      <Box
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: CHANNEL_LIST_DESKTOP_TEMPLATE,
          columnGap: 2,
          alignItems: 'center',
        }}
      >
        <Box sx={{ minWidth: 0, pr: 1 }}>{renderChannelHeader()}</Box>

        {/* Quality / Folder Column */}
        <Box
          sx={{
            minWidth: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            alignItems: 'center',
          }}
        >
          <QualityChip videoQuality={channel.video_quality} globalPreferredResolution={globalPreferredResolution} />
          <SubFolderChip subFolder={channel.sub_folder} />
        </Box>

        {/* Auto Downloads Column */}
        <Box
          sx={{
            minWidth: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            alignItems: 'center',
          }}
        >
          <DownloadFormatConfigIndicator audioFormat={channel.audio_format} />
          <AutoDownloadChips
            availableTabs={channel.available_tabs}
            autoDownloadTabs={channel.auto_download_enabled_tabs}
            isMobile={isMobile}
          />
        </Box>

        {/* Filters Column */}
        <Box
          sx={{
            minWidth: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            alignItems: 'center',
          }}
        >
          <DurationFilterChip minDuration={channel.min_duration} maxDuration={channel.max_duration} isMobile={isMobile} />
          <TitleFilterChip titleFilterRegex={channel.title_filter_regex} onRegexClick={onRegexClick} isMobile={isMobile} />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Tooltip title="Remove channel">
            <IconButton color="error" onClick={onDelete} aria-label="Remove channel">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </ListItem>
  );
};

export default ChannelListRow;
