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
import { SubFolderChip, QualityChip, AutoDownloadChips, DurationFilterChip, TitleFilterChip } from './chips';

interface ChannelListRowProps {
  channel: Channel;
  isMobile: boolean;
  globalPreferredResolution: string;
  onNavigate: () => void;
  onDelete: () => void;
  import { QualityChip, AutoDownloadChips, DurationFilterChip, TitleFilterChip } from './chips';
  isPendingAddition?: boolean;
  rowIndex?: number;
}

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
  const avatarSize = isMobile ? 56 : 72;

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
          sx={{ width: avatarSize, height: avatarSize }}
          imgProps={{ onError: () => setThumbnailVisible(false) }}
        />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 0 }}>
          <Typography variant={isMobile ? 'h6' : 'h5'} noWrap sx={{ minWidth: 0 }}>
            {channel.uploader || 'Unknown Channel'}
          </Typography>
        </Box>
        {isPendingAddition && <Chip label="Pending addition" size="small" color="warning" sx={{ mt: 0.5 }} />}
      </Box>
    </Box>
  );

  const zebraBackground = typeof rowIndex === 'number' && rowIndex % 2 === 1 ? 'action.hover' : undefined;

  return (
    <ListItem
      divider
      sx={{
        flexDirection: 'column',
        alignItems: 'stretch',
        bgcolor: isPendingAddition ? 'action.hover' : zebraBackground,
        borderLeft: isPendingAddition ? (theme) => `4px solid ${theme.palette.warning.main}` : '4px solid transparent',
        px: { xs: 1, md: 2 },
        py: 1.5,
      }}
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, width: '100%' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>{renderChannelHeader()}</Box>
          <Tooltip title="Remove channel">
            <IconButton color="error" onClick={onDelete} aria-label="Remove channel" size={isMobile ? 'small' : 'medium'}>
              <DeleteIcon fontSize={isMobile ? 'small' : 'medium'} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
            alignItems: 'center',
          }}
        >
          <QualityChip videoQuality={channel.video_quality} globalPreferredResolution={globalPreferredResolution} />
          <SubFolderChip subFolder={channel.sub_folder} />
          <AutoDownloadChips
            availableTabs={channel.available_tabs}
            autoDownloadTabs={channel.auto_download_enabled_tabs}
            isMobile={isMobile}
          />
          {hasFilters && (
            <Divider orientation="vertical" flexItem sx={{ alignSelf: 'stretch', mx: 0.5 }} aria-hidden />
          )}
          <DurationFilterChip minDuration={channel.min_duration} maxDuration={channel.max_duration} isMobile={isMobile} />
          <TitleFilterChip titleFilterRegex={channel.title_filter_regex} onRegexClick={onRegexClick} isMobile={isMobile} />
        </Box>
      </Box>
    </ListItem>
  );
};

export default ChannelListRow;
