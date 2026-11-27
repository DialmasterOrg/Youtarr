import React from 'react';
import { Card, Typography, Grid, Fade } from '../ui';
import { CalendarToday as CalendarTodayIcon, Download as DownloadIcon } from '../../lib/icons';
import { ChannelVideo } from '../../types/ChannelVideo';
import { decodeHtml, formatAddedDateTime } from '../../utils/formatters';
import { isMembersOnlyVideo } from '../../utils/videoStatus';
import MembersAccessChip from '../shared/MembersAccessChip';
import MediaTypeChip from '../shared/MediaTypeChip';
import VideoStatusChip from '../shared/VideoStatusChip';
import RatingBadge from '../shared/RatingBadge';
import DownloadFormatIndicator from '../shared/DownloadFormatIndicator';
import WatchedChip from '../shared/WatchedChip';
import { SHARED_STATUS_CHIP_SMALL_STYLE } from '../shared/chipStyles';
import ChannelVideoThumbnail from './components/ChannelVideoThumbnail';
import { getPublishedDateDisplay } from './publishedDateDisplay';
import { getChannelVideoRowState, toggleRowSelection } from './channelVideoRowState';

interface VideoCardProps {
  video: ChannelVideo;
  isMobile: boolean;
  checkedBoxes: string[];
  hoveredVideo: string | null;
  selectedForDeletion: string[];
  selectionMode: 'download' | 'delete' | null;
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onHoverChange: (videoId: string | null) => void;
  onDeletionChange: (videoId: string, isChecked: boolean) => void;
  onToggleIgnore: (youtubeId: string) => void;
  onToggleProtection: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
  isInteractive?: boolean;
  onVideoClick?: (video: ChannelVideo) => void;
}

function VideoCard({
  video,
  isMobile,
  checkedBoxes,
  hoveredVideo,
  selectedForDeletion,
  selectionMode,
  onCheckChange,
  onHoverChange,
  onDeletionChange,
  onToggleIgnore,
  onToggleProtection,
  onMobileTooltip,
  isInteractive = false,
  onVideoClick,
}: VideoCardProps) {
  const row = getChannelVideoRowState(video, selectionMode, checkedBoxes, selectedForDeletion);
  const { status, canDownload, canDelete, isChecked, isDeleteChecked } = row;
  const isIgnored = status === 'ignored';
  const baseTransform = isInteractive ? 'var(--sticker-rest-transform)' : 'translate(0, 0)';
  const isClickable = canDownload || canDelete;

  return (
    <Fade in timeout={300} key={video.youtube_id}>
      <Grid item xs={12} sm={6} md={4} lg={3}>
        <Card
          data-testid="video-card"
          className={isInteractive ? 'wiggle-card' : undefined}
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            cursor: isClickable ? 'pointer' : 'default',
            opacity: status === 'members_only' || isIgnored ? 0.7 : 1,
            transform: hoveredVideo === video.youtube_id ? 'var(--sticker-hover-transform)' : baseTransform,
            boxShadow: hoveredVideo === video.youtube_id ? 'var(--card-hover-shadow)' : 'var(--shadow-soft)',
            overflow: 'hidden',
            borderRadius: 'var(--radius-ui)',
            outline: isDeleteChecked ? '2px solid var(--destructive)' : isChecked ? '2px solid var(--primary)' : '2px solid transparent',
            outlineOffset: '0px',
            transition: 'transform 0.2s, box-shadow 0.2s, outline-color 0.2s',
          }}
          onMouseEnter={() => onHoverChange(video.youtube_id)}
          onMouseLeave={() => onHoverChange(null)}
          onClick={() => toggleRowSelection(video, row, onCheckChange, onDeletionChange)}
        >
          <ChannelVideoThumbnail
            video={video}
            row={row}
            size="card"
            isMobile={isMobile}
            onCheckChange={onCheckChange}
            onDeletionChange={onDeletionChange}
            onToggleIgnore={onToggleIgnore}
            onToggleProtection={onToggleProtection}
            onMobileTooltip={onMobileTooltip}
            onVideoClick={onVideoClick}
          />

          {/* Card content */}
          <div style={{ padding: isMobile ? 12 : 16, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="body2"
              onClick={onVideoClick ? (e: React.MouseEvent) => {
                e.stopPropagation();
                onVideoClick(video);
              } : undefined}
              sx={{
                mb: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
                minHeight: '2.6em',
                cursor: onVideoClick ? 'pointer' : 'default',

              }}
              title={decodeHtml(video.title)}
            >
              {decodeHtml(video.title)}
            </Typography>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Date and download format info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {video.media_type !== 'short' && (video.publishedAt || video.published_at_source === 'estimated') && (
                <Typography variant="caption" color="text.secondary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarTodayIcon size={12} />
                  {getPublishedDateDisplay(video, (d) => isMobile
                    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : d.toLocaleDateString())}
                </Typography>
              )}
                {video.added && !video.removed && (
                  <DownloadFormatIndicator
                    filePath={video.filePath}
                    audioFilePath={video.audioFilePath}
                    fileSize={video.fileSize}
                    audioFileSize={video.audioFileSize}
                    videoResolution={video.video_resolution}
                  />
                )}
              </div>
              {video.added && video.timeCreated && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                >
                  <DownloadIcon size={12} />
                  Downloaded: {formatAddedDateTime(video.timeCreated)}
                </Typography>
              )}

              {/* Media type, rating, and status chips on same line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <MediaTypeChip mediaType={video.media_type} style={{ minWidth: 'fit-content' }} />
                {/* The status chip already reads Members Only when no cookies are set. */}
                {!video.added && isMembersOnlyVideo(video) && video.members_access && video.members_access !== 'no_cookies' && (
                  <MembersAccessChip access={video.members_access} />
                )}
                <RatingBadge
                  rating={video.normalized_rating}
                  ratingSource={video.rating_source}
                  showNA={true}
                  size="small"
                  style={{ ...SHARED_STATUS_CHIP_SMALL_STYLE, flexShrink: 0 }}
                />
                <WatchedChip watchedBy={video.watchedBy || []} />
                <VideoStatusChip
                  status={status}
                  downloadedLabel="Available"
                  removalRow={video}
                  style={{ flex: '0 0 auto', minWidth: 'fit-content' }}
                />
              </div>
            </div>
          </div>
        </Card>
      </Grid>
    </Fade>
  );
}

export default VideoCard;
