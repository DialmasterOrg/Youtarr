import React, { useState, useMemo } from 'react';
import { Box, Typography, Chip, Link, Skeleton, Collapse, Button } from '../../../ui';
import {
  Eye as VisibilityIcon,
  ThumbsUp as ThumbUpIcon,
  CalendarToday as CalendarTodayIcon,
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '../../../../lib/icons';
import { MessageSquare as ChatBubbleOutlineIcon } from 'lucide-react';
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
      {/* Channel and date */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {video.channelName}
        </Typography>
        {publishDate && (
          <>
            <Typography variant="body2" color="text.disabled" sx={{ lineHeight: 1 }}>
              ·
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarTodayIcon size={18} color="var(--muted-foreground)" />
              <Typography variant="body2" color="text.secondary">
                {publishDate}
              </Typography>
            </Box>
          </>
        )}
      </Box>

      {/* Stats row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        {video.duration !== null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon size={18} color="var(--muted-foreground)" />
            <Typography variant="body2" color="text.secondary">
              {formatDuration(video.duration)}
            </Typography>
          </Box>
        )}

        {loading ? (
          <>
            <Skeleton width={60} height={20} />
            <Skeleton width={60} height={20} />
          </>
        ) : (
          <>
            {metadata?.viewCount !== null && metadata?.viewCount !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <VisibilityIcon size={18} color="var(--muted-foreground)" />
                <Typography variant="body2" color="text.secondary">
                  {formatCount(metadata.viewCount)}
                </Typography>
              </Box>
            )}

            {metadata?.likeCount !== null && metadata?.likeCount !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ThumbUpIcon size={18} color="var(--muted-foreground)" />
                <Typography variant="body2" color="text.secondary">
                  {formatCount(metadata.likeCount)}
                </Typography>
              </Box>
            )}

            {metadata?.commentCount !== null && metadata?.commentCount !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ChatBubbleOutlineIcon size={18} color="var(--muted-foreground)" />
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
              color="primary"
              onClick={() => setTagsExpanded(true)}
              sx={{ cursor: 'pointer', fontWeight: 500 }}
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
          <Box sx={{ position: 'relative' }}>
            <div style={{ maxHeight: descriptionExpanded ? undefined : 72, overflow: 'hidden' }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {description}
              </Typography>
            </div>
            {!descriptionExpanded && needsTruncation && (
              <Box
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 36,
                  background: 'linear-gradient(to bottom, transparent, var(--card))',
                  pointerEvents: 'none',
                }}
              />
            )}
          </Box>
          {needsTruncation && (
            <Button
              size="small"
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              endIcon={descriptionExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ textTransform: 'none', marginTop: 4, fontWeight: 500 }}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            YouTube ID
          </Typography>
          <Typography
            variant="caption"
            style={{
              fontFamily: 'monospace',
              backgroundColor: 'var(--muted)',
              color: 'var(--foreground)',
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
              fontSize: '0.7rem',
            }}
          >
            {video.youtubeId}
          </Typography>
        </Box>
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
