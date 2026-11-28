import React from 'react';
import VideoActivityChip from '../../shared/VideoActivityChip';
import { Box, Typography, Checkbox, Stack } from '../../ui';
import { getRemovalState } from '../../../utils/videoRemoval';
import RemovalDescription from '../../shared/RemovalDescription';
import { formatYTDate } from '../../../utils';
import { formatAddedDateTime, formatFileSize } from '../../../utils/formatters';
import { getEnabledChannelId } from '../../../utils/enabledChannels';
import { VideoData, EnabledChannel } from '../../../types/VideoData';
import RatingBadge from '../../shared/RatingBadge';
import DownloadFormatIndicator from '../../shared/DownloadFormatIndicator';
import ProtectionShieldButton from '../../shared/ProtectionShieldButton';
import ThumbnailClickOverlay from '../../shared/ThumbnailClickOverlay';
import AvailabilityChip from '../../shared/AvailabilityChip';
import WatchedChip from '../../shared/WatchedChip';
import MediaTypeChip from '../../shared/MediaTypeChip';
import VideoThumbnail from '../../shared/VideoThumbnail';
import { DurationBadge, YoutubeRemovedBanner } from '../../shared/thumbnailOverlays';
import { SHARED_COMPACT_CHIP_OVERRIDES } from '../../shared/chipStyles';
import ChannelNameDisplay from '../../shared/ChannelNameDisplay';

export interface VideosListMobileProps {
  videos: VideoData[];
  selectedVideos: number[];
  enabledChannels: EnabledChannel[];
  onToggleSelect: (videoId: number) => void;
  onOpenModal: (video: VideoData) => void;
  onToggleProtection: (videoId: number) => void;
  onAddChannel: (channelName: string, channelUrl: string) => void;
}

function VideosListMobile({
  videos,
  selectedVideos,
  enabledChannels,
  onToggleSelect,
  onOpenModal,
  onToggleProtection,
  onAddChannel,
}: VideosListMobileProps) {
  return (
    <Box>
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
          <Box
            key={video.id}
            role="button"
            tabIndex={0}
            onClick={() => onToggleSelect(video.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onToggleSelect(video.id);
              }
            }}
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 4px',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              backgroundColor: isSelected ? 'var(--muted)' : undefined,
              transition: 'background-color 0.15s ease',
              alignItems: 'flex-start',
            }}
          >
            <Box
              style={{
                flexShrink: 0,
                width: 120,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
              onClick={(e) => e.stopPropagation()}
            >
            <VideoThumbnail video={video} width={120} height={68} iconSize={24}>
              <ThumbnailClickOverlay
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onOpenModal(video);
                }}
              />
              {video.youtube_removed && <YoutubeRemovedBanner compact />}
              <DurationBadge duration={video.duration} compact />
              <Checkbox
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={(event) => {
                  event.stopPropagation();
                  onToggleSelect(video.id);
                }}
                inputProps={{ 'aria-label': `Select ${video.youTubeVideoName}` }}
                style={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  padding: 2,
                  backgroundColor: 'var(--media-overlay-background)',
                  color: 'var(--media-overlay-foreground)',
                  zIndex: 3,
                }}
              />
              {!video.removed && (
                <ProtectionShieldButton
                  isProtected={video.protected || false}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleProtection(video.id);
                  }}
                  style={{ position: 'absolute', bottom: 2, left: 2, zIndex: 3 }}
                />
              )}
            </VideoThumbnail>
            <Typography
              variant="caption"
              color="text.secondary"
              style={{
                fontSize: '0.65rem',
                lineHeight: 1.25,
                textAlign: 'center',
              }}
            >
              Published: {formatYTDate(video.originalDate)}
            </Typography>
          </Box>

            <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography
                variant="subtitle2"
                className="font-semibold"
                style={{
                  cursor: 'pointer',
                  lineHeight: 1.25,
                  fontSize: '0.85rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal(video);
                }}
              >
                {video.youTubeVideoName}
              </Typography>
              <ChannelNameDisplay
                channelName={video.youTubeChannelName}
                enabledChannelId={channelId}
                videoChannelId={video.channel_id}
                variant="caption"
                className="block truncate"
                style={{ fontSize: '0.7rem' }}
                onAddChannel={onAddChannel}
              />
              <Stack direction="row" spacing={0.5} className="flex-wrap gap-1">
                <VideoActivityChip youtubeId={video.youtubeId} />
                {!video.removed && (video.filePath || video.audioFilePath) && (
                  <DownloadFormatIndicator
                    filePath={video.filePath}
                    audioFilePath={video.audioFilePath}
                    fileSize={video.fileSize}
                    audioFileSize={video.audioFileSize}
                    videoResolution={video.video_resolution}
                    compact
                  />
                )}
                <MediaTypeChip mediaType={video.media_type} style={SHARED_COMPACT_CHIP_OVERRIDES} />
                <RatingBadge
                  rating={video.normalized_rating}
                  ratingSource={video.rating_source}
                  showNA
                  size="small"
                  style={SHARED_COMPACT_CHIP_OVERRIDES}
                />
                {video.removed ? (
                  <AvailabilityChip state={getRemovalState(video.removed, video.removed_reason)} tooltip={<RemovalDescription row={video} />} compact />
                ) : video.fileSize ? (
                  <AvailabilityChip state="present" compact />
                ) : null}
                <WatchedChip watchedBy={video.watchedBy || []} compact />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                style={{ fontSize: '0.65rem', lineHeight: 1.3 }}
              >
                Downloaded: {formatAddedDateTime(video.timeCreated)}
                {fileSizeNumber && !(video.filePath || video.audioFilePath)
                  ? ` • ${formatFileSize(fileSizeNumber)}`
                  : ''}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default VideosListMobile;
