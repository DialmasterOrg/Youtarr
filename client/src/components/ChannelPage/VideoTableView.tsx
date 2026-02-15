import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Box,
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RatingBadge from '../shared/RatingBadge';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo } from '../../utils/videoStatus';
import StillLiveDot from './StillLiveDot';
import DownloadFormatIndicator from '../shared/DownloadFormatIndicator';

type SortBy = 'date' | 'title' | 'duration' | 'size';
type SortOrder = 'asc' | 'desc';

interface VideoTableViewProps {
  videos: ChannelVideo[];
  checkedBoxes: string[];
  selectedForDeletion: string[];
  sortBy: SortBy;
  sortOrder: SortOrder;
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSortChange: (newSortBy: SortBy) => void;
  onToggleDeletion: (youtubeId: string) => void;
  onToggleIgnore: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
}

function VideoTableView({
  videos,
  checkedBoxes,
  selectedForDeletion,
  sortBy,
  sortOrder,
  onCheckChange,
  onSelectAll,
  onClearSelection,
  onSortChange,
  onToggleDeletion,
  onToggleIgnore,
  onMobileTooltip,
}: VideoTableViewProps) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={checkedBoxes.length > 0 && checkedBoxes.length < videos.length}
                checked={videos.length > 0 && checkedBoxes.length === videos.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    onSelectAll();
                  } else {
                    onClearSelection();
                  }
                }}
              />
            </TableCell>
            <TableCell>Thumbnail</TableCell>
            <TableCell onClick={() => onSortChange('title')} sx={{ cursor: 'pointer' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Title
                {sortBy === 'title' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                )}
              </Box>
            </TableCell>
            <TableCell onClick={() => onSortChange('date')} sx={{ cursor: 'pointer' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Published
                {sortBy === 'date' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                )}
              </Box>
            </TableCell>
            <TableCell onClick={() => onSortChange('duration')} sx={{ cursor: 'pointer' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Duration
                {sortBy === 'duration' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                )}
              </Box>
            </TableCell>
            <TableCell onClick={() => onSortChange('size')} sx={{ cursor: 'pointer' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Size
                {sortBy === 'size' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                )}
              </Box>
            </TableCell>
            <TableCell>Rating</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {videos.map((video) => {
            const status = getVideoStatus(video);
            // Check if video is still live (not "was_live" and not null/undefined)
            const isStillLive = video.live_status && video.live_status !== 'was_live';
            const isSelectable = (status === 'never_downloaded' || status === 'missing' || status === 'ignored') && !video.youtube_removed && !isStillLive;
            const isChecked = checkedBoxes.includes(video.youtube_id);
            const mediaTypeInfo = getMediaTypeInfo(video.media_type);

            return (
              <TableRow
                key={video.youtube_id}
                hover
                sx={{
                  opacity: status === 'members_only' || status === 'ignored' ? 0.7 : 1,
                  cursor: isSelectable ? 'pointer' : 'default',
                }}
              >
                <TableCell padding="checkbox">
                  {isStillLive ? (
                    <StillLiveDot isMobile={false} onMobileClick={onMobileTooltip} />
                  ) : isSelectable && (
                    <Checkbox
                      checked={isChecked}
                      onChange={(e) => onCheckChange(video.youtube_id, e.target.checked)}
                    />
                  )}
                  {/* Delete icon for downloaded videos that exist on disk */}
                  {video.added && !video.removed && (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDeletion(video.youtube_id);
                      }}
                      sx={{
                        color: selectedForDeletion.includes(video.youtube_id) ? 'error.main' : 'action.active',
                        '&:hover': {
                          color: 'error.main',
                          bgcolor: 'error.light',
                        },
                      }}
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                  {/* Ignore/Unignore button - for videos not currently on disk (never downloaded or missing) */}
                  {!isStillLive && (!video.added || video.removed) && (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleIgnore(video.youtube_id);
                      }}
                      sx={{
                        color: status === 'ignored' ? 'warning.main' : 'action.active',
                        '&:hover': {
                          color: status === 'ignored' ? 'warning.dark' : 'warning.main',
                          bgcolor: 'warning.light',
                        },
                      }}
                      size="small"
                      title={status === 'ignored' ? 'Unignore' : 'Ignore'}
                    >
                      {status === 'ignored' ? <CheckCircleOutlineIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                    </IconButton>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ position: 'relative', display: 'inline-block', bgcolor: 'grey.900', borderRadius: '4px' }}>
                    <img
                      src={video.thumbnail}
                      alt={decodeHtml(video.title)}
                      style={{
                        // Keep container size consistent - shorts use contain to show with black bars
                        width: 120,
                        height: 67,
                        objectFit: video.media_type === 'short' ? 'contain' : 'cover',
                        borderRadius: 4,
                        display: 'block'
                      }}
                      loading="lazy"
                    />
                    {video.youtube_removed && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          backgroundColor: 'rgba(211, 47, 47, 0.95)',
                          color: 'white',
                          padding: '2px 4px',
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        }}
                      >
                        Removed From YouTube
                      </Box>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {decodeHtml(video.title)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {video.media_type === 'short' || !video.publishedAt
                    ? 'N/A'
                    : new Date(video.publishedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {video.media_type === 'short' ? 'N/A' : formatDuration(video.duration)}
                </TableCell>
                <TableCell>
                  {(video.filePath || video.audioFilePath) ? (
                    <DownloadFormatIndicator
                      filePath={video.filePath}
                      audioFilePath={video.audioFilePath}
                      fileSize={video.fileSize}
                      audioFileSize={video.audioFileSize}
                    />
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <RatingBadge
                    rating={video.normalized_rating}
                    ratingSource={video.rating_source}
                    size="small"
                    variant="text"
                    showNA
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {mediaTypeInfo && (
                      <Chip
                        size="small"
                        icon={mediaTypeInfo.icon}
                        label={mediaTypeInfo.label}
                        color={mediaTypeInfo.color}
                        variant="outlined"
                      />
                    )}
                    <Chip
                      icon={getStatusIcon(status)}
                      label={getStatusLabel(status)}
                      size="small"
                      color={getStatusColor(status)}
                      variant={status === 'downloaded' ? 'filled' : 'outlined'}
                    />
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default VideoTableView;
