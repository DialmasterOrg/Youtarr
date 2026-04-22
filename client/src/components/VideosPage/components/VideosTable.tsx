import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
  Chip,
  Tooltip,
  IconButton,
  Box,
  Stack,
} from '../../ui';
import {
  AlertCircle as ErrorOutlineIcon,
  CheckCircle as CheckCircleIcon,
  Clock as ScheduleIcon,
  Video as VideoLibraryIcon,
  Trash2 as DeleteIcon,
} from 'lucide-react';
import { formatDuration, formatYTDate } from '../../../utils';
import { formatAddedDateTime, formatFileSize } from '../../../utils/formatters';
import { VideoData, EnabledChannel } from '../../../types/VideoData';
import RatingBadge from '../../shared/RatingBadge';
import DownloadFormatIndicator from '../../shared/DownloadFormatIndicator';
import ProtectionShieldButton from '../../shared/ProtectionShieldButton';
import ThumbnailClickOverlay from '../../shared/ThumbnailClickOverlay';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_THEMED_CHIP_SMALL_STYLE } from '../../shared/chipStyles';

export interface VideosTableProps {
  videos: VideoData[];
  selectedVideos: number[];
  enabledChannels: EnabledChannel[];
  imageErrors: Record<string, boolean>;
  orderBy: 'published' | 'added';
  sortOrder: 'asc' | 'desc';
  deleteDisabled: boolean;
  onSelectAll: (checked: boolean) => void;
  onToggleSelect: (videoId: number) => void;
  onSortChange: (newOrderBy: 'published' | 'added') => void;
  onOpenModal: (video: VideoData) => void;
  onToggleProtection: (videoId: number) => void;
  onDeleteSingle: (videoId: number) => void;
  onImageError: (youtubeId: string) => void;
}

const chipStyle = {
  available: {
    ...SHARED_THEMED_CHIP_SMALL_STYLE,
    backgroundColor: 'var(--success)',
    color: 'var(--success-foreground)',
  } as React.CSSProperties,
  missing: {
    ...SHARED_THEMED_CHIP_SMALL_STYLE,
    backgroundColor: 'var(--destructive)',
    color: 'var(--destructive-foreground)',
  } as React.CSSProperties,
};

function getMediaTypeInfo(mediaType?: string) {
  switch (mediaType) {
    case 'short':
      return { label: 'Short', color: 'secondary' as const, icon: <ScheduleIcon /> };
    case 'livestream':
      return { label: 'Live', color: 'error' as const, icon: <VideoLibraryIcon /> };
    case 'video':
    default:
      return null;
  }
}

function getEnabledChannelId(
  channelName: string,
  videoChannelId: string | null | undefined,
  enabledChannels: EnabledChannel[]
): string | null {
  if (videoChannelId) {
    const match = enabledChannels.find((ch) => ch.channel_id === videoChannelId);
    if (match) return match.channel_id;
  }
  const match = enabledChannels.find((ch) => ch.uploader === channelName);
  return match ? match.channel_id : null;
}

function VideosTable({
  videos,
  selectedVideos,
  enabledChannels,
  imageErrors,
  orderBy,
  sortOrder,
  deleteDisabled,
  onSelectAll,
  onToggleSelect,
  onSortChange,
  onOpenModal,
  onToggleProtection,
  onDeleteSingle,
  onImageError,
}: VideosTableProps) {
  const selectableVideos = videos.filter((v) => !v.removed);
  const selectableIds = selectableVideos.map((v) => v.id);
  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedVideos.includes(id));
  const someSelectableSelected =
    !allSelectableSelected && selectableIds.some((id) => selectedVideos.includes(id));

  return (
    <Paper style={{ overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell component="th" style={{ width: 48 }}>
                <Checkbox
                  indeterminate={someSelectableSelected}
                  checked={allSelectableSelected}
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
              const isSelectable = !video.removed;
              const isSelected = selectedVideos.includes(video.id);
              const channelId = getEnabledChannelId(
                video.youTubeChannelName,
                video.channel_id,
                enabledChannels
              );
              const mediaTypeInfo = getMediaTypeInfo(video.media_type);
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
                    cursor: isSelectable ? 'pointer' : 'default',
                    backgroundColor: isSelected ? 'var(--muted)' : undefined,
                    transition: 'background-color 0.15s ease',
                  }}
                  onClick={() => {
                    if (isSelectable) onToggleSelect(video.id);
                  }}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      disabled={!isSelectable}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleSelect(video.id)}
                      inputProps={{ 'aria-label': `Select ${video.youTubeVideoName}` }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box
                      style={{
                        position: 'relative',
                        width: 144,
                        height: 81,
                        overflow: 'hidden',
                        backgroundColor: 'var(--media-placeholder-background)',
                        borderRadius: 'var(--radius-thumb)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {imageErrors[video.youtubeId] ? (
                        <Typography
                          variant="caption"
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                          }}
                        >
                          No thumbnail
                        </Typography>
                      ) : (
                        <img
                          src={`/images/videothumb-${video.youtubeId}.jpg`}
                          alt="thumbnail"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: video.media_type === 'short' ? 'contain' : 'cover',
                            filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                          }}
                          onError={() => onImageError(video.youtubeId)}
                        />
                      )}
                      <ThumbnailClickOverlay
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onOpenModal(video);
                        }}
                      />
                      {video.youtube_removed && (
                        <Box
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: 'var(--media-overlay-danger-background)',
                            color: 'var(--media-overlay-foreground)',
                            padding: '2px 4px',
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            zIndex: 2,
                          }}
                        >
                          Removed
                        </Box>
                      )}
                      {video.removed && (
                        <Box
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(244, 67, 54, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1,
                            pointerEvents: 'none',
                          }}
                        >
                          <ErrorOutlineIcon
                            className="text-destructive"
                            style={{ fontSize: '1.5rem' }}
                          />
                        </Box>
                      )}
                    </Box>
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
                    {channelId ? (
                      <Typography
                        component={RouterLink}
                        to={`/channel/${channelId}`}
                        variant="body2"
                        className="text-primary no-underline hover:underline"
                      >
                        {video.youTubeChannelName}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {video.youTubeChannelName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    {formatYTDate(video.originalDate)}
                  </TableCell>
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    {formatAddedDateTime(video.timeCreated)}
                  </TableCell>
                  <TableCell style={{ whiteSpace: 'nowrap' }}>
                    {video.duration ? formatDuration(video.duration) : '-'}
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
                      {!video.removed && (video.filePath || video.audioFilePath) && (
                        <DownloadFormatIndicator
                          filePath={video.filePath}
                          audioFilePath={video.audioFilePath}
                          fileSize={video.fileSize}
                          audioFileSize={video.audioFileSize}
                        />
                      )}
                      {mediaTypeInfo && (
                        <Chip
                          size="small"
                          icon={mediaTypeInfo.icon}
                          label={mediaTypeInfo.label}
                          color={mediaTypeInfo.color}
                          variant="outlined"
                          style={SHARED_STATUS_CHIP_SMALL_STYLE}
                        />
                      )}
                      {video.removed ? (
                        <Tooltip title="Video file not found on disk" enterTouchDelay={0}>
                          <Chip
                            size="small"
                            icon={<ErrorOutlineIcon size={12} />}
                            label="Missing"
                            color="error"
                            variant="filled"
                            style={chipStyle.missing}
                          />
                        </Tooltip>
                      ) : video.fileSize ? (
                        <Tooltip title="Video file exists on disk" enterTouchDelay={0}>
                          <Chip
                            size="small"
                            icon={<CheckCircleIcon size={12} />}
                            label="Available"
                            color="success"
                            variant="filled"
                            style={chipStyle.available}
                          />
                        </Tooltip>
                      ) : null}
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
