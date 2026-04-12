import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Link,
  Skeleton,
  Collapse,
  Button,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { VideoModalData, VideoExtendedMetadata } from '../types';
import { YOUTUBE_URL_BASE } from '../constants';

interface VideoMetadataProps {
  video: VideoModalData;
  metadata: VideoExtendedMetadata | null;
  loading: boolean;
}

const DESCRIPTION_PREVIEW_LENGTH = 300;
const VISIBLE_TAGS_COUNT = 6;

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toLocaleString();
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function parseDate(dateStr: string): Date | null {
  // Handle YYYYMMDD format from yt-dlp
  if (/^\d{8}$/.test(dateStr)) {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);
    return new Date(year, month, day);
  }
  // Handle ISO strings and other formats
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = parseDate(dateStr);
  if (!date) return null;
  return date.toLocaleDateString();
}

function VideoMetadata({ video, metadata, loading }: VideoMetadataProps) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const publishDate = useMemo(
    () => formatDate(metadata?.uploadDate ?? video.publishedAt),
    [metadata?.uploadDate, video.publishedAt]
  );

  const description = metadata?.description ?? null;
  const needsTruncation = description !== null && description.length > DESCRIPTION_PREVIEW_LENGTH;

  const allTags = useMemo(() => {
    const tags = metadata?.tags ?? [];
    const categories = metadata?.categories ?? [];
    const combined = [...new Set([...categories, ...tags])];
    return combined;
  }, [metadata?.tags, metadata?.categories]);

  const visibleTags = tagsExpanded ? allTags : allTags.slice(0, VISIBLE_TAGS_COUNT);
  const hiddenTagsCount = allTags.length - VISIBLE_TAGS_COUNT;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Stats row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {video.channelName}
        </Typography>

        {publishDate && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {publishDate}
            </Typography>
          </Box>
        )}

        {video.duration !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {formatDuration(video.duration)}
            </Typography>
          </Box>
        )}

        {loading ? (
          <>
            <Skeleton width={60} height={20} />
            <Skeleton width={60} height={20} />
            <Skeleton width={60} height={20} />
          </>
        ) : (
          <>
            {metadata?.viewCount !== null && metadata?.viewCount !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <VisibilityIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {formatCount(metadata.viewCount)}
                </Typography>
              </Box>
            )}

            {metadata?.likeCount !== null && metadata?.likeCount !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ThumbUpIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {formatCount(metadata.likeCount)}
                </Typography>
              </Box>
            )}

            {metadata?.commentCount !== null && metadata?.commentCount !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ChatBubbleOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {formatCount(metadata.commentCount)}
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Tags / Categories */}
      {loading ? (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" width={70} height={24} />
          ))}
        </Box>
      ) : allTags.length > 0 ? (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {visibleTags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
          {hiddenTagsCount > 0 && !tagsExpanded && (
            <Chip
              label={`+${hiddenTagsCount} more`}
              size="small"
              onClick={() => setTagsExpanded(true)}
              sx={{ cursor: 'pointer' }}
            />
          )}
          {tagsExpanded && allTags.length > VISIBLE_TAGS_COUNT && (
            <Chip
              label="Show less"
              size="small"
              onClick={() => setTagsExpanded(false)}
              sx={{ cursor: 'pointer' }}
            />
          )}
        </Box>
      ) : null}

      {/* Description */}
      {loading ? (
        <Box>
          <Skeleton width="100%" height={20} />
          <Skeleton width="100%" height={20} />
          <Skeleton width="80%" height={20} />
        </Box>
      ) : description ? (
        <Box>
          <Collapse in={descriptionExpanded} collapsedSize={60}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {descriptionExpanded
                ? description
                : needsTruncation
                  ? `${description.substring(0, DESCRIPTION_PREVIEW_LENGTH)}...`
                  : description}
            </Typography>
          </Collapse>
          {needsTruncation && (
            <Button
              size="small"
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              endIcon={descriptionExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ textTransform: 'none', mt: 0.5, p: 0, minWidth: 0 }}
            >
              {descriptionExpanded ? 'Show less' : 'Show more'}
            </Button>
          )}
        </Box>
      ) : null}

      {/* Footer: YouTube ID and link */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pt: 1,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          ID: {video.youtubeId}
        </Typography>
        <Link
          href={`${YOUTUBE_URL_BASE}${video.youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          variant="caption"
        >
          Open on YouTube
        </Link>
      </Box>
    </Box>
  );
}

export default VideoMetadata;
