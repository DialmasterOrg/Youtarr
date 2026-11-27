import React from 'react';
import { Card, Typography, CardContent, Fade } from '../ui';
import { CalendarToday as CalendarTodayIcon } from '../../lib/icons';
import { ChannelVideo } from '../../types/ChannelVideo';
import { decodeHtml, formatAddedDate } from '../../utils/formatters';
import { SHARED_STATUS_CHIP_SMALL_STYLE } from '../shared/chipStyles';
import ChannelVideoThumbnail from './components/ChannelVideoThumbnail';
import { getPublishedDateDisplay } from './publishedDateDisplay';
import { getChannelVideoRowState, toggleRowSelection } from './channelVideoRowState';
import { isMembersOnlyVideo } from '../../utils/videoStatus';
import MembersAccessChip from '../shared/MembersAccessChip';
import MediaTypeChip from '../shared/MediaTypeChip';
import VideoStatusChip from '../shared/VideoStatusChip';
import DownloadFormatIndicator from '../shared/DownloadFormatIndicator';
import RatingBadge from '../shared/RatingBadge';
import WatchedChip from '../shared/WatchedChip';

interface VideoListItemProps {
  video: ChannelVideo;
  checkedBoxes: string[];
  selectedForDeletion: string[];
  selectionMode: 'download' | 'delete' | null;
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onDeletionChange: (videoId: string, isChecked: boolean) => void;
  onToggleIgnore: (youtubeId: string) => void;
  onToggleProtection: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
  onVideoClick?: (video: ChannelVideo) => void;
}

function VideoListItem({
  video,
  checkedBoxes,
  selectedForDeletion,
  selectionMode,
  onCheckChange,
  onDeletionChange,
  onToggleIgnore,
  onToggleProtection,
  onMobileTooltip,
  onVideoClick,
}: VideoListItemProps) {
  const row = getChannelVideoRowState(video, selectionMode, checkedBoxes, selectedForDeletion);
  const { status, canDownload, canDelete, isChecked, isDeleteChecked } = row;
  const isIgnored = status === 'ignored';
  const isClickable = canDownload || canDelete;

  return (
    <Fade in timeout={300} key={video.youtube_id}>
      <Card
        style={{
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          transition: 'all 0.2s ease',
          cursor: isClickable ? 'pointer' : 'default',
          opacity: status === 'members_only' || isIgnored ? 0.7 : 1,
          outline: isDeleteChecked ? '2px solid var(--destructive)' : isChecked ? '2px solid var(--primary)' : '2px solid transparent',
          outlineOffset: '0px',
        }}
        onClick={() => toggleRowSelection(video, row, onCheckChange, onDeletionChange)}
      >
        <ChannelVideoThumbnail
          video={video}
          row={row}
          size="row"
          isMobile
          onCheckChange={onCheckChange}
          onDeletionChange={onDeletionChange}
          onToggleIgnore={onToggleIgnore}
          onToggleProtection={onToggleProtection}
          onMobileTooltip={onMobileTooltip}
          onVideoClick={onVideoClick}
        />

        {/* Content */}
        <CardContent style={{ flex: 1, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }}>
          {/* Title */}
          <Typography
            variant="body2"
            onClick={onVideoClick ? (e: React.MouseEvent) => {
              e.stopPropagation();
              onVideoClick(video);
            } : undefined}
            sx={{
              mb: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.3,
              fontSize: '0.875rem',
              cursor: onVideoClick ? 'pointer' : 'default',
            }}
            className={onVideoClick ? 'hover:underline' : ''}
            title={decodeHtml(video.title)}
          >
            {decodeHtml(video.title)}
          </Typography>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
            {video.media_type !== 'short' && (video.publishedAt || video.published_at_source === 'estimated') && (
            <Typography variant="caption" color="text.secondary" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.7rem' }}>
                <CalendarTodayIcon size={11} />
              {getPublishedDateDisplay(video, (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }))}
            </Typography>
          )}
            {video.added && video.timeCreated && (
              <Typography
                variant="caption"
                color="text.secondary"
                style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}
              >
                Downloaded: {formatAddedDate(video.timeCreated)}
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
            <MediaTypeChip mediaType={video.media_type} />
            {/* The status chip already reads Members Only when no cookies are set. */}
            {!video.added && isMembersOnlyVideo(video) && video.members_access && video.members_access !== 'no_cookies' && (
              <MembersAccessChip access={video.members_access} />
            )}
            <RatingBadge
              rating={video.normalized_rating}
              ratingSource={video.rating_source}
              size="small"
              variant="pill"
              showNA
              style={{ ...SHARED_STATUS_CHIP_SMALL_STYLE }}
            />
            <WatchedChip watchedBy={video.watchedBy || []} />
            <VideoStatusChip
              status={status}
              downloadedLabel="Available"
              removalRow={video}
              style={{ flex: '0 0 auto' }}
            />
          </div>
        </CardContent>
      </Card>
    </Fade>
  );
}

export default VideoListItem;
