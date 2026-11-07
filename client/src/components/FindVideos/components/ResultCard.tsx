import React from 'react';
import { Box, Card, CardActionArea, Checkbox, Typography, Chip } from '../../ui';
import { formatDurationClock } from '../../../utils';
import { isSelectableForDownload, ResultSelection, SearchResult } from '../types';
import {
  AddChannelHandler,
  DownloadButton,
  PublishedDate,
  ResultChannel,
  ResultStatusChip,
  ShortBadge,
  ViewCount,
} from './resultParts';

interface ResultCardProps {
  result: SearchResult;
  onClick: () => void;
  selection?: ResultSelection;
  onAddChannel?: AddChannelHandler;
  onDownloadOne?: (result: SearchResult) => void;
}

const THUMB_OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  padding: 4,
  borderRadius: 'var(--radius-ui)',
  backgroundColor: 'var(--media-overlay-background)',
  zIndex: 3,
};

export default function ResultCard({ result, onClick, selection, onAddChannel, onDownloadOne }: ResultCardProps) {
  const durationLabel = formatDurationClock(result.duration);
  const selectable = Boolean(selection) && isSelectableForDownload(result.status);
  const checked = selectable && selection!.isChecked(result.youtubeId);

  return (
    <Card className="relative cursor-pointer overflow-hidden hover:shadow-md transition-shadow">
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
          {selectable && (
            <Box
              onClick={(e) => e.stopPropagation()}
              style={{ ...THUMB_OVERLAY_STYLE, left: 4 }}
            >
              <Checkbox
                checked={checked}
                onChange={() => selection!.toggle(result.youtubeId)}
                inputProps={{
                  'aria-label': `Select ${result.title} for download`,
                  'data-testid': `select-${result.youtubeId}`,
                }}
              />
            </Box>
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
          <ResultChannel
            result={result}
            variant="caption"
            className="text-muted-foreground truncate"
            onAddChannel={onAddChannel}
          />
          <Box className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <PublishedDate publishedAt={result.publishedAt} />
            <ViewCount viewCount={result.viewCount} />
            <ShortBadge duration={result.duration} />
            <ResultStatusChip status={result.status} />
          </Box>
        </Box>
      </CardActionArea>
      {/* Outside the action area so the button is not nested in the card's own button role. */}
      {onDownloadOne && isSelectableForDownload(result.status) && (
        <Box style={{ ...THUMB_OVERLAY_STYLE, right: 4 }}>
          <DownloadButton result={result} onDownload={onDownloadOne} className="text-[var(--media-overlay-foreground)]" />
        </Box>
      )}
    </Card>
  );
}
