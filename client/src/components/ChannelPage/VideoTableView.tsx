import React from 'react';
import {
  Checkbox,
  Typography,
  Chip,
} from '../ui';
import { ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon, Block as BlockIcon, CheckCircleOutline as CheckCircleOutlineIcon, Delete as DeleteIcon } from '../../lib/icons';
import ProtectionShieldButton from '../shared/ProtectionShieldButton';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo, getStatusChipVariant, getStatusChipStyle } from '../../utils/videoStatus';
import StillLiveDot from './StillLiveDot';
import RatingBadge from '../shared/RatingBadge';
import DownloadFormatIndicator from '../shared/DownloadFormatIndicator';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_THEMED_CHIP_SMALL_STYLE } from '../shared/chipStyles';
import ThumbnailClickOverlay from '../shared/ThumbnailClickOverlay';

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
  onToggleProtection: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
  onVideoClick?: (video: ChannelVideo) => void;
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
  onToggleProtection,
  onMobileTooltip,
  onVideoClick,
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
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th style={{ width: 48, maxWidth: 48, padding: '8px 4px' }}>
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
            </th>
            <th style={{ width: 140, padding: '8px 4px', textAlign: 'left' }}>Thumbnail</th>
            <th style={{ cursor: 'pointer', width: '36%', padding: '8px 4px', textAlign: 'left' }} onClick={() => onSortChange('title')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Title
                {sortBy === 'title' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon size={16} data-testid="ArrowUpwardIcon" /> : <ArrowDownwardIcon size={16} data-testid="ArrowDownwardIcon" />
                )}
              </div>
            </th>
            <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', width: 110, padding: '8px 4px', textAlign: 'left' }} onClick={() => onSortChange('date')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Published
                {sortBy === 'date' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon size={16} data-testid="ArrowUpwardIcon" /> : <ArrowDownwardIcon size={16} data-testid="ArrowDownwardIcon" />
                )}
              </div>
            </th>
            <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', width: 90, padding: '8px 4px', textAlign: 'left' }} onClick={() => onSortChange('duration')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Duration
                {sortBy === 'duration' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon size={16} data-testid="ArrowUpwardIcon" /> : <ArrowDownwardIcon size={16} data-testid="ArrowDownwardIcon" />
                )}
              </div>
            </th>
            <th style={{ width: 90, padding: '8px 4px', textAlign: 'left' }}>Rating</th>
            <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', width: 90, padding: '8px 4px', textAlign: 'left' }} onClick={() => onSortChange('size')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Size
                {sortBy === 'size' && (
                  sortOrder === 'asc' ? <ArrowUpwardIcon size={16} data-testid="ArrowUpwardIcon" /> : <ArrowDownwardIcon size={16} data-testid="ArrowDownwardIcon" />
                )}
              </div>
            </th>
            <th style={{ whiteSpace: 'nowrap', width: 140, padding: '8px 4px', textAlign: 'left' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video) => {
            const status = getVideoStatus(video);
            const statusLabel = status === 'downloaded' ? 'Available' : getStatusLabel(status);
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
              <tr
                key={video.youtube_id}
                style={{
                  opacity: status === 'members_only' || status === 'ignored' ? 0.7 : 1,
                  cursor: isClickable ? 'pointer' : 'default',
                  borderBottom: '1px solid var(--border)',
                }}
                onClick={() => {
                  if (isDownloadSelectable && isDownloadAllowed) {
                    onCheckChange(video.youtube_id, !isChecked);
                    return;
                  }
                  if (isDeleteSelectable && isDeleteAllowed) {
                    onDeletionChange(video.youtube_id, !isDeleteChecked);
                  }
                }}
              >
                <td style={{ width: 48, maxWidth: 48, padding: '8px 4px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    {isStillLive ? (
                      <StillLiveDot isMobile={false} onMobileClick={onMobileTooltip} />
                    ) : isDownloadSelectable && isDownloadAllowed && (
                      <Checkbox
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onCheckChange(video.youtube_id, e.target.checked)}
                      />
                    )}
                    {isDeleteSelectable && isDeleteAllowed && (
                      isDeleteMode ? (
                        <Checkbox
                          checked={isDeleteChecked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onDeletionChange(video.youtube_id, e.target.checked)}
                        />
                      ) : (
                        <button
                          type="button"
                          aria-label="delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletionChange(video.youtube_id, !isDeleteChecked);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 4,
                            color: 'var(--destructive)',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <DeleteIcon size={16} data-testid="DeleteIcon" />
                        </button>
                      )
                    )}
                    {!isStillLive && (!video.added || video.removed) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleIgnore(video.youtube_id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          color: status === 'ignored' ? 'var(--warning)' : 'var(--muted-foreground)',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                        title={status === 'ignored' ? 'Unignore' : 'Ignore'}
                      >
                        {status === 'ignored' ? <CheckCircleOutlineIcon size={16} /> : <BlockIcon size={16} />}
                      </button>
                    )}
                    {/* Protection shield for downloaded videos */}
                    {video.added && !video.removed && (
                      <ProtectionShieldButton
                        isProtected={video.protected || false}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleProtection(video.youtube_id);
                        }}
                        variant="inline"
                      />
                    )}
                  </div>
                </td>
                <td style={{ width: 140, padding: '8px 4px' }}>
                  <div style={{ position: 'relative', display: 'inline-block', backgroundColor: 'var(--media-placeholder-background)', borderRadius: 'var(--radius-thumb)', overflow: 'hidden' }}>
                    <img
                      src={video.thumbnail}
                      alt={decodeHtml(video.title)}
                      style={{
                        width: 120,
                        height: 67,
                        objectFit: video.media_type === 'short' ? 'contain' : 'cover',
                        borderRadius: 'var(--radius-thumb)',
                        display: 'block'
                      }}
                      loading="lazy"
                    />
                    {/* Center hotspot for opening video modal */}
                    {onVideoClick && (
                      <ThumbnailClickOverlay
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onVideoClick(video);
                        }}
                      />
                    )}
                    {video.youtube_removed && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          backgroundColor: 'var(--media-overlay-danger-background)',
                          color: 'var(--media-overlay-foreground)',
                          padding: '2px 4px',
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          borderTopLeftRadius: 'var(--radius-thumb)',
                          borderTopRightRadius: 'var(--radius-thumb)',
                        }}
                      >
                        Removed From YouTube
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ width: '36%', padding: '8px 4px' }}>
                  <Typography
                    variant="body2"
                    onClick={onVideoClick ? (e: React.MouseEvent) => {
                      e.stopPropagation();
                      onVideoClick(video);
                    } : undefined}
                    sx={{
                      mb: 0.5,
                      whiteSpace: 'normal',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      cursor: onVideoClick ? 'pointer' : 'default',

                    }}
                  >
                    {decodeHtml(video.title)}
                  </Typography>
                </td>
                <td style={{ whiteSpace: 'nowrap', padding: '8px 4px' }}>
                  {video.media_type === 'short' || !video.publishedAt
                    ? 'N/A'
                    : new Date(video.publishedAt).toLocaleDateString()}
                </td>
                <td style={{ whiteSpace: 'nowrap', padding: '8px 4px' }}>
                  {video.media_type === 'short' ? 'N/A' : formatDuration(video.duration)}
                </td>
                <td style={{ width: 90, whiteSpace: 'nowrap', padding: '8px 4px' }}>
                  <RatingBadge
                    rating={video.normalized_rating}
                    ratingSource={video.rating_source}
                    showNA={true}
                    size="small"
                    style={{ ...SHARED_STATUS_CHIP_SMALL_STYLE, flexWrap: 'nowrap', justifyContent: 'center' }}
                  />
                </td>
                <td style={{ whiteSpace: 'nowrap', padding: '8px 4px' }}>
                  {(video.filePath || video.audioFilePath) ? (
                    <DownloadFormatIndicator
                      filePath={video.filePath}
                      audioFilePath={video.audioFilePath}
                      fileSize={video.fileSize}
                      audioFileSize={video.audioFileSize}
                    />
                  ) : '-'}
                </td>
                <td style={{ whiteSpace: 'nowrap', padding: '8px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>
                    {mediaTypeInfo && (
                      <Chip
                        size="small"
                        icon={mediaTypeInfo.icon}
                        label={mediaTypeInfo.label}
                        color={mediaTypeInfo.color}
                        variant="outlined"
                        style={{ ...SHARED_STATUS_CHIP_SMALL_STYLE }}
                      />
                    )}
                    <Chip
                      icon={getStatusIcon(status)}
                      label={statusLabel}
                      size="small"
                      color={getStatusColor(status)}
                      variant={getStatusChipVariant(status)}
                      style={{ ...SHARED_THEMED_CHIP_SMALL_STYLE, ...getStatusChipStyle(status) }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default VideoTableView;
