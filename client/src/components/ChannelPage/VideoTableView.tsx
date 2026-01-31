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
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo } from '../../utils/videoStatus';
import StillLiveDot from './StillLiveDot';
import RatingBadge from '../shared/RatingBadge';
import DownloadFormatIndicator from '../shared/DownloadFormatIndicator';

type SortBy = 'date' | 'title' | 'duration' | 'size';
type SortOrder = 'asc' | 'desc';

interface VideoTableViewProps {
  videos: ChannelVideo[];
  checkedBoxes: string[];
  selectedForDeletion: string[];
  selectionMode: 'download' | 'delete' | null;
  sortBy: SortBy;
  sortOrder: SortOrder;
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSortChange: (newSortBy: SortBy) => void;
  onDeletionChange: (videoId: string, isChecked: boolean) => void;
  onToggleIgnore: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
}

function VideoTableView({
  videos,
  checkedBoxes,
  selectedForDeletion,
  selectionMode,
  sortBy,
  sortOrder,
  onCheckChange,
  onSelectAll,
  onClearSelection,
  onSortChange,
  onDeletionChange,
  onToggleIgnore,
  onMobileTooltip,
}: VideoTableViewProps) {
  const isDeleteMode = selectionMode === 'delete';
  const effectiveSelection = isDeleteMode ? selectedForDeletion : checkedBoxes;
  const selectableVideos = videos.filter((video) => {
    const status = getVideoStatus(video);
    const isStillLive = video.live_status && video.live_status !== 'was_live';
    if (isDeleteMode) {
      return video.added && !video.removed && !isStillLive;
    }
    return (status === 'never_downloaded' || status === 'missing' || status === 'ignored') && !video.youtube_removed && !isStillLive;
  });

  return (
    <TableContainer>
      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={{ width: 48, maxWidth: 48 }}>
              <Checkbox
                indeterminate={effectiveSelection.length > 0 && effectiveSelection.length < selectableVideos.length}
                checked={selectableVideos.length > 0 && effectiveSelection.length === selectableVideos.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    onSelectAll();
                  } else {
                    onClearSelection();
                  }
                }}
              />
            </TableCell>
            <TableCell sx={{ width: 140 }}>Thumbnail</TableCell>
            <TableCell onClick={() => onSortChange('title')} sx={{ cursor: 'pointer', width: '36%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Title
                {sortBy === 'title' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                )}
              </Box>
            </TableCell>
            <TableCell onClick={() => onSortChange('date')} sx={{ cursor: 'pointer', whiteSpace: 'nowrap', width: 110 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Published
                {sortBy === 'date' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                )}
              </Box>
            </TableCell>
            <TableCell onClick={() => onSortChange('duration')} sx={{ cursor: 'pointer', whiteSpace: 'nowrap', width: 90 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Duration
                {sortBy === 'duration' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                )}
              </Box>
            </TableCell>
            <TableCell sx={{ width: 90, whiteSpace: 'normal' }}>Rating</TableCell>
            <TableCell onClick={() => onSortChange('size')} sx={{ cursor: 'pointer', whiteSpace: 'nowrap', width: 90 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Size
                {sortBy === 'size' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                )}
              </Box>
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', width: 140 }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {videos.map((video) => {
            const status = getVideoStatus(video);
            // Check if video is still live (not "was_live" and not null/undefined)
            const isStillLive = video.live_status && video.live_status !== 'was_live';
            const isDownloadSelectable = (status === 'never_downloaded' || status === 'missing' || status === 'ignored') && !video.youtube_removed && !isStillLive;
            const isDeleteSelectable = video.added && !video.removed && !isStillLive;
            const isDownloadAllowed = selectionMode !== 'delete';
            const isDeleteAllowed = selectionMode !== 'download';
            const isChecked = checkedBoxes.includes(video.youtube_id);
            const isDeleteChecked = selectedForDeletion.includes(video.youtube_id);
            const mediaTypeInfo = getMediaTypeInfo(video.media_type);
            const isClickable = (isDownloadSelectable && isDownloadAllowed) || (isDeleteSelectable && isDeleteAllowed);

            return (
              <TableRow
                key={video.youtube_id}
                hover
                sx={{
                  opacity: status === 'members_only' || status === 'ignored' ? 0.7 : 1,
                  cursor: isClickable ? 'pointer' : 'default',
                }}
              >
                <TableCell padding="checkbox" sx={{ width: 48, maxWidth: 48 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                    {isStillLive ? (
                      <StillLiveDot isMobile={false} onMobileClick={onMobileTooltip} />
                    ) : isDownloadSelectable && isDownloadAllowed && (
                      <Checkbox
                        checked={isChecked}
                        onChange={(e) => onCheckChange(video.youtube_id, e.target.checked)}
                      />
                    )}
                    {isDeleteSelectable && isDeleteAllowed && (
                      <Checkbox
                        checked={isDeleteChecked}
                        onChange={(e) => onDeletionChange(video.youtube_id, e.target.checked)}
                        sx={{
                          '&.Mui-checked': {
                            color: 'error.main',
                          },
                        }}
                      />
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
                  </Box>
                </TableCell>
                <TableCell sx={{ width: 140 }}>
                  <Box sx={{ position: 'relative', display: 'inline-block', bgcolor: 'grey.900', borderRadius: 'var(--radius-thumb)', overflow: 'hidden' }}>
                    <img
                      src={video.thumbnail}
                      alt={decodeHtml(video.title)}
                      style={{
                        // Keep container size consistent - shorts use contain to show with black bars
                        width: 120,
                        height: 67,
                        objectFit: video.media_type === 'short' ? 'contain' : 'cover',
                        borderRadius: 'var(--radius-thumb)',
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
                          borderTopLeftRadius: 'var(--radius-thumb)',
                          borderTopRightRadius: 'var(--radius-thumb)',
                        }}
                      >
                        Removed From YouTube
                      </Box>
                    )}
                  </Box>
                </TableCell>
                <TableCell sx={{ width: '36%' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      mb: 0.5,
                      whiteSpace: 'normal',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {decodeHtml(video.title)}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {video.media_type === 'short' || !video.publishedAt
                    ? 'N/A'
                    : new Date(video.publishedAt).toLocaleDateString()}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {video.media_type === 'short' ? 'N/A' : formatDuration(video.duration)}
                </TableCell>
                <TableCell sx={{ width: 90, whiteSpace: 'nowrap' }}>
                  <RatingBadge
                    rating={video.normalized_rating}
                    ratingSource={video.rating_source}
                    showNA={true}
                    size="small"
                    sx={{ flexWrap: 'nowrap', justifyContent: 'center' }}
                  />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {(video.filePath || video.audioFilePath) ? (
                    <DownloadFormatIndicator
                      filePath={video.filePath}
                      audioFilePath={video.audioFilePath}
                      fileSize={video.fileSize}
                      audioFileSize={video.audioFileSize}
                    />
                  ) : '-'}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', overflow: 'hidden' }}>
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
