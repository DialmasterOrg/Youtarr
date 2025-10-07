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
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { formatFileSize, decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo } from '../../utils/videoStatus';

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
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {videos.map((video) => {
            const status = getVideoStatus(video);
            const isSelectable = (status === 'never_downloaded' || status === 'missing') && !video.youtube_removed;
            const isChecked = checkedBoxes.includes(video.youtube_id);
            const mediaTypeInfo = getMediaTypeInfo(video.media_type);

            return (
              <TableRow
                key={video.youtube_id}
                hover
                sx={{
                  opacity: status === 'members_only' ? 0.6 : 1,
                  cursor: isSelectable ? 'pointer' : 'default',
                }}
              >
                <TableCell padding="checkbox">
                  {isSelectable && (
                    <Checkbox
                      checked={isChecked}
                      onChange={(e) => onCheckChange(video.youtube_id, e.target.checked)}
                    />
                  )}
                  {status === 'downloaded' && (
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
                </TableCell>
                <TableCell>
                  <Box sx={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={video.thumbnail}
                      alt={decodeHtml(video.title)}
                      style={{ width: 120, height: 67, objectFit: 'cover', borderRadius: 4, display: 'block' }}
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
                  {new Date(video.publishedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {formatDuration(video.duration)}
                </TableCell>
                <TableCell>
                  {video.fileSize ? formatFileSize(video.fileSize) : '-'}
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
