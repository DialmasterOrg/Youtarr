import React from 'react';
import VideoActivityChip from '../../shared/VideoActivityChip';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  Checkbox,
  Tooltip,
  IconButton,
  Box,
  Stack,
} from '../../ui';
import { Trash2 as DeleteIcon } from 'lucide-react';
import { formatDuration, formatYTDate } from '../../../utils';
import { formatAddedDateTime, formatFileSize } from '../../../utils/formatters';
import { getEnabledChannelId } from '../../../utils/enabledChannels';
import { VideoData, EnabledChannel } from '../../../types/VideoData';
import RatingBadge from '../../shared/RatingBadge';
import DownloadFormatIndicator from '../../shared/DownloadFormatIndicator';
import ProtectionShieldButton from '../../shared/ProtectionShieldButton';
import ThumbnailClickOverlay from '../../shared/ThumbnailClickOverlay';
import AvailabilityChip from '../../shared/AvailabilityChip';
import MediaTypeChip from '../../shared/MediaTypeChip';
import VideoThumbnail from '../../shared/VideoThumbnail';
import { YoutubeRemovedBanner } from '../../shared/thumbnailOverlays';
import { getRemovalState } from '../../../utils/videoRemoval';
import RemovalDescription from '../../shared/RemovalDescription';
import ChannelNameDisplay from '../../shared/ChannelNameDisplay';
import WatchedChip from '../../shared/WatchedChip';

export interface VideosTableProps {
  videos: VideoData[];
  selectedVideos: number[];
  enabledChannels: EnabledChannel[];
  orderBy: 'published' | 'added';
  sortOrder: 'asc' | 'desc';
  deleteDisabled: boolean;
  onSelectAll: (checked: boolean) => void;
  onToggleSelect: (videoId: number) => void;
  onSortChange: (newOrderBy: 'published' | 'added') => void;
  onOpenModal: (video: VideoData) => void;
  onToggleProtection: (videoId: number) => void;
  onDeleteSingle: (videoId: number) => void;
  onAddChannel: (channelName: string, channelUrl: string) => void;
}

function VideosTable({
  videos,
  selectedVideos,
  enabledChannels,
  orderBy,
  sortOrder,
  deleteDisabled,
  onSelectAll,
  onToggleSelect,
  onSortChange,
  onOpenModal,
  onToggleProtection,
  onDeleteSingle,
  onAddChannel,
}: VideosTableProps) {
  const allIds = videos.map((v) => v.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedVideos.includes(id));
  const someSelected = !allSelected && allIds.some((id) => selectedVideos.includes(id));

  return (
    <Paper style={{ overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell component="th" style={{ width: 48 }}>
                <Checkbox
                  indeterminate={someSelected}
                  checked={allSelected}
                  onChange={(event) => onSelectAll(event.target.checked)}
                  inputProps={{ 'aria-label': 'Select all videos' }}
                />
              </TableCell>
              <TableCell component="th" style={{ width: 160 }}>Thumbnail</TableCell>
              <TableCell component="th">Title</TableCell>
              <TableCell component="th" style={{ width: '18%' }}>Channel</TableCell>
              <TableCell component="th" style={{ whiteSpace: 'nowrap', width: 120 }}>
                <TableSortLabel
                  active={orderBy === 'published'}
                  direction={orderBy === 'published' ? sortOrder : 'asc'}
                  onClick={() => onSortChange('published')}
                >
                  Published
                </TableSortLabel>
              </TableCell>
              <TableCell component="th" style={{ whiteSpace: 'nowrap', width: 120 }}>
                <TableSortLabel
                  active={orderBy === 'added'}
                  direction={orderBy === 'added' ? sortOrder : 'asc'}
                  onClick={() => onSortChange('added')}
                >
                  Downloaded
                </TableSortLabel>
              </TableCell>
              <TableCell component="th" style={{ whiteSpace: 'nowrap', width: 90 }}>Duration</TableCell>
              <TableCell component="th" style={{ whiteSpace: 'nowrap', width: 90 }}>Size</TableCell>
              <TableCell component="th" style={{ width: 90 }}>Rating</TableCell>
              <TableCell component="th" style={{ whiteSpace: 'nowrap', width: 180 }}>Status</TableCell>
              <TableCell component="th" style={{ whiteSpace: 'nowrap', width: 90 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {videos.map((video) => {
              const isSelected = selectedVideos.includes(video.id);
              const channelId = getEnabledChannelId(
                video.youTubeChannelName,
                video.channel_id,
                enabledChannels
              );
              const fileSizeNumber = video.fileSize
                ? typeof video.fileSize === 'string'
                  ? parseInt(video.fileSize, 10)
                  : video.fileSize
                : null;

              return (
                <TableRow
                  key={video.id}
                  hover
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--muted)' : undefined,
                    transition: 'background-color 0.15s ease',
                  }}
                  onClick={() => onToggleSelect(video.id)}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleSelect(video.id)}
                      inputProps={{ 'aria-label': `Select ${video.youTubeVideoName}` }}
                    />
                  </TableCell>
                  <TableCell>
                    <VideoThumbnail
                      video={video}
                      width={144}
                      height={81}
                      iconSize={24}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ThumbnailClickOverlay
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onOpenModal(video);
                        }}
                      />
                      {video.youtube_removed && <YoutubeRemovedBanner compact />}
                    </VideoThumbnail>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Typography
                      variant="body2"
                      className="font-semibold"
                      style={{
                        cursor: 'pointer',
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      onClick={() => onOpenModal(video)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpenModal(video);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {video.youTubeVideoName}
                    </Typography>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <ChannelNameDisplay
                      channelName={video.youTubeChannelName}
                      enabledChannelId={channelId}
                      videoChannelId={video.channel_id}
                      variant="body2"
                      onAddChannel={onAddChannel}
                    />
                  </TableCell>
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    {formatYTDate(video.originalDate)}
                  </TableCell>
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    {formatAddedDateTime(video.timeCreated)}
                  </TableCell>
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    {formatDuration(video.duration) || '-'}
                  </TableCell>
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    {fileSizeNumber ? formatFileSize(fileSizeNumber) : '-'}
                  </TableCell>
                  <TableCell>
                    <RatingBadge
                      rating={video.normalized_rating}
                      ratingSource={video.rating_source}
                      showNA
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} className="flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                      <VideoActivityChip youtubeId={video.youtubeId} />
                      {!video.removed && (video.filePath || video.audioFilePath) && (
                        <DownloadFormatIndicator
                          filePath={video.filePath}
                          audioFilePath={video.audioFilePath}
                          fileSize={video.fileSize}
                          audioFileSize={video.audioFileSize}
                          videoResolution={video.video_resolution}
                        />
                      )}
                      <MediaTypeChip mediaType={video.media_type} />
                      {video.removed ? (
                        <AvailabilityChip state={getRemovalState(video.removed, video.removed_reason)} tooltip={<RemovalDescription row={video} />} />
                      ) : video.fileSize ? (
                        <AvailabilityChip state="present" />
                      ) : null}
                      <WatchedChip watchedBy={video.watchedBy || []} />
                    </Stack>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Box className="flex items-center gap-1">
                      {!video.removed && (
                        <ProtectionShieldButton
                          isProtected={video.protected || false}
                          onClick={() => onToggleProtection(video.id)}
                          variant="inline"
                        />
                      )}
                      {!video.removed && (
                        <Tooltip title="Delete video from disk">
                          <span>
                            <IconButton
                              color="error"
                              size="small"
                              data-testid="DeleteIcon"
                              aria-label="Delete video from disk"
                              onClick={() => onDeleteSingle(video.id)}
                              disabled={deleteDisabled}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default VideosTable;
