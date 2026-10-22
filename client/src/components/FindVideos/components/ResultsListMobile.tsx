import React from 'react';
import { Checkbox, Typography, Chip } from '../../ui';
import { formatDurationClock } from '../../../utils';
import {
  isSelectableForDownload,
  ResultSelection,
  SearchResult,
  THUMB_WIDTH,
  THUMB_HEIGHT,
} from '../types';
import {
  AddChannelHandler,
  DownloadButton,
  PublishedDate,
  ResultChannel,
  ResultStatusChip,
  ShortBadge,
  ViewCount,
} from './resultParts';

interface ResultsListMobileProps {
  results: SearchResult[];
  onResultClick: (result: SearchResult) => void;
  selection?: ResultSelection;
  onAddChannel?: AddChannelHandler;
  onDownloadOne?: (result: SearchResult) => void;
}

export default function ResultsListMobile({
  results, onResultClick, selection, onAddChannel, onDownloadOne,
}: ResultsListMobileProps) {
  return (
    <div className="flex flex-col">
      {results.map((result) => {
        const durationLabel = formatDurationClock(result.duration);
        const selectable = Boolean(selection) && isSelectableForDownload(result.status);
        const checked = selectable && selection!.isChecked(result.youtubeId);
        return (
          <div
            key={result.youtubeId}
            role="button"
            tabIndex={0}
            aria-label={`Open ${result.title}`}
            onClick={() => onResultClick(result)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onResultClick(result);
              }
            }}
            className="flex gap-3 py-2 px-1 border-b border-border cursor-pointer items-start"
          >
            {selectable && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center pt-1"
              >
                <Checkbox
                  checked={checked}
                  onChange={() => selection!.toggle(result.youtubeId)}
                  inputProps={{
                    'aria-label': `Select ${result.title} for download`,
                    'data-testid': `select-mobile-${result.youtubeId}`,
                  }}
                />
              </div>
            )}
            <div
              className="relative shrink-0 overflow-hidden bg-[var(--media-placeholder-background)] rounded-[var(--radius-thumb)]"
              style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
            >
              {result.thumbnailUrl && (
                <img
                  src={result.thumbnailUrl}
                  alt=""
                  className="block object-cover rounded-[var(--radius-thumb)]"
                  style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                  loading="lazy"
                />
              )}
              {durationLabel && (
                <Chip
                  label={durationLabel}
                  size="small"
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    backgroundColor: 'var(--media-overlay-background-strong)',
                    color: 'var(--media-overlay-foreground)',
                    fontSize: '0.7rem',
                    height: 18,
                  }}
                />
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <Typography
                variant="body2"
                className="line-clamp-2 whitespace-normal text-sm leading-[1.3]"
              >
                {result.title}
              </Typography>
              <ResultChannel
                result={result}
                variant="caption"
                className="text-muted-foreground block truncate text-xs"
                onAddChannel={onAddChannel}
              />
              <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[0.7rem] text-muted-foreground">
                <PublishedDate publishedAt={result.publishedAt} iconSize={11} />
                <ViewCount viewCount={result.viewCount} iconSize={11} />
                <ShortBadge duration={result.duration} />
                <ResultStatusChip status={result.status} />
              </div>
            </div>
            {onDownloadOne && (
              <div className="shrink-0 self-center">
                <DownloadButton result={result} onDownload={onDownloadOne} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
