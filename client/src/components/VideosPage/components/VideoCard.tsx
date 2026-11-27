import React from 'react';
import VideoActivityChip from '../../shared/VideoActivityChip';
import { Card, Typography, Box, Checkbox, IconButton, Tooltip } from '../../ui';
import {
  HardDrive as StorageIcon,
  Trash2 as DeleteIcon,
  Download as DownloadIcon,
  Clock as ScheduleIcon,
  AlarmCheck as AlarmOnIcon,
} from 'lucide-react';
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

export interface VideoCardProps {
  video: VideoData;
  selected: boolean;
  enabledChannels: EnabledChannel[];
  deleteDisabled: boolean;
  onToggleSelect: (videoId: number) => void;
  onOpenModal: (video: VideoData) => void;
  onToggleProtection: (videoId: number) => void;
  onDeleteSingle: (videoId: number) => void;
  onAddChannel: (channelName: string, channelUrl: string) => void;
}

function VideoCard({
  video,
  selected,
  enabledChannels,
  deleteDisabled,
  onToggleSelect,
  onOpenModal,
  onToggleProtection,
  onDeleteSingle,
  onAddChannel,
}: VideoCardProps) {
  const channelId = getEnabledChannelId(video.youTubeChannelName, video.channel_id, enabledChannels);
  const fileSizeNumber = video.fileSize
    ? typeof video.fileSize === 'string'
      ? parseInt(video.fileSize, 10)
      : video.fileSize
    : null;

  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        borderRadius: 'var(--radius-ui)',
        outline: selected ? '2px solid var(--primary)' : '2px solid transparent',
        transition: 'outline-color 0.15s ease',
      }}
    >
      <VideoThumbnail video={video} iconSize={24} onClick={() => onOpenModal(video)}>
        <ThumbnailClickOverlay
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onOpenModal(video);
          }}
        />

        {video.youtube_removed && <YoutubeRemovedBanner />}

        <Checkbox
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            onToggleSelect(video.id);
          }}
          inputProps={{ 'aria-label': `Select ${video.youTubeVideoName}` }}
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            backgroundColor: 'var(--media-overlay-background)',
            color: 'var(--media-overlay-foreground)',
            transition: 'all 0.2s',
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
            style={{ position: 'absolute', bottom: 6, left: 6, zIndex: 3 }}
          />
        )}
      </VideoThumbnail>

      <Box className="flex flex-col gap-2" style={{ padding: 12, flex: 1 }}>
        <Box>
          <Typography
            variant="subtitle2"
            className="font-semibold"
            style={{
              lineHeight: 1.3,
              cursor: 'pointer',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word',
              minHeight: '2.6em',
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
            title={video.youTubeVideoName}
          >
            {video.youTubeVideoName}
          </Typography>
          <ChannelNameDisplay
            channelName={video.youTubeChannelName}
            enabledChannelId={channelId}
            videoChannelId={video.channel_id}
            variant="caption"
            className="block"
            onAddChannel={onAddChannel}
          />
        </Box>

        <Box className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          {video.duration ? (
            <Box className="flex items-center gap-1">
              <AlarmOnIcon size={14} className="text-muted-foreground" />
              <Typography variant="caption" className="text-muted-foreground">
                {formatDuration(video.duration)}
              </Typography>
            </Box>
          ) : null}
          <Box className="flex items-center gap-1">
            <ScheduleIcon size={14} className="text-muted-foreground" />
            <Typography variant="caption" className="text-muted-foreground">
              Published: {formatYTDate(video.originalDate)}
            </Typography>
          </Box>
          {fileSizeNumber && !(video.filePath || video.audioFilePath) ? (
            <Box className="flex items-center gap-1">
              <StorageIcon size={14} className="text-muted-foreground" />
              <Typography variant="caption" className="text-muted-foreground">
                {formatFileSize(fileSizeNumber)}
              </Typography>
            </Box>
          ) : null}
          <Box className="col-span-2 flex items-center gap-1">
            <DownloadIcon size={14} className="text-muted-foreground" />
            <Typography
              variant="caption"
              className="text-muted-foreground"
              style={{ whiteSpace: 'nowrap' }}
            >
              Downloaded: {formatAddedDateTime(video.timeCreated)}
            </Typography>
          </Box>
        </Box>

        <Box
          className="flex items-start gap-1"
          style={{ marginTop: 'auto' }}
        >
          <Box className="flex flex-wrap items-center gap-1" style={{ flex: 1, minWidth: 0 }}>
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
            <RatingBadge
              rating={video.normalized_rating}
              ratingSource={video.rating_source}
              showNA
              size="small"
            />
            {video.removed ? (
              <AvailabilityChip state={getRemovalState(video.removed, video.removed_reason)} tooltip={<RemovalDescription row={video} />} />
            ) : video.fileSize ? (
              <AvailabilityChip state="present" />
            ) : null}
            <WatchedChip watchedBy={video.watchedBy || []} />
          </Box>
          {!video.removed && (
            <Tooltip title="Delete video from disk">
              <span style={{ flexShrink: 0 }}>
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
      </Box>
    </Card>
  );
}

export default VideoCard;
