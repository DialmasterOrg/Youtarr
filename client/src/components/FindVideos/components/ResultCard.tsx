import React from 'react';
import { Box, Card, CardActionArea, Typography, Chip } from '../../ui';
import { CalendarToday as CalendarTodayIcon } from '../../../lib/icons';
import {
  getStatusColor,
  getStatusIcon,
  getStatusLabel,
  getStatusChipVariant,
  getStatusChipStyle,
  VideoStatus,
} from '../../../utils/videoStatus';
import { SHARED_THEMED_CHIP_SMALL_STYLE } from '../../shared/chipStyles';
import { SearchResult } from '../types';

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface ResultCardProps {
  result: SearchResult;
  onClick: () => void;
}

export default function ResultCard({ result, onClick }: ResultCardProps) {
  const status: VideoStatus = result.status;
  const durationLabel = formatDuration(result.duration);

  return (
    <Card className="cursor-pointer overflow-hidden hover:shadow-md transition-shadow">
      <CardActionArea
        onClick={onClick}
        aria-label={`Open ${result.title}`}
      >
        <Box className="relative aspect-video bg-muted">
          {result.thumbnailUrl && (
            <img
              src={result.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
          {durationLabel && (
            <Chip
              label={durationLabel}
              size="small"
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: 'var(--media-overlay-background-strong)',
                color: 'var(--media-overlay-foreground)',
                fontSize: '0.75rem',
                height: 22,
              }}
            />
          )}
        </Box>
        <Box className="p-2 flex flex-col gap-2">
          <Typography variant="body2" className="font-semibold line-clamp-2">{result.title}</Typography>
          <Typography variant="caption" className="text-muted-foreground">{result.channelName}</Typography>
          <Box className="flex items-center gap-2 flex-wrap">
            {result.publishedAt && (
              <Typography
                variant="caption"
                className="text-muted-foreground inline-flex items-center gap-1"
              >
                <CalendarTodayIcon size={12} />
                {new Date(result.publishedAt).toLocaleDateString()}
              </Typography>
            )}
            <Chip
              icon={getStatusIcon(status)}
              label={getStatusLabel(status)}
              size="small"
              color={getStatusColor(status)}
              variant={getStatusChipVariant(status)}
              style={{
                flex: '0 0 auto',
                minWidth: 'fit-content',
                ...SHARED_THEMED_CHIP_SMALL_STYLE,
                ...getStatusChipStyle(status),
              }}
            />
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}
