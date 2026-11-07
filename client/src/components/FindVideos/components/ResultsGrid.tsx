import React from 'react';
import { Box, Typography, Alert, Button, Skeleton } from '../../ui';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { ResultSort, SortKey } from '../sortResults';
import { ResultSelection, SearchResult, PageSize, ViewMode, THUMB_WIDTH, THUMB_HEIGHT } from '../types';
import ResultCard from './ResultCard';
import ResultsTable from './ResultsTable';
import ResultsListMobile from './ResultsListMobile';
import { AddChannelHandler } from './resultParts';

// Placeholder rows beyond the first screen are never seen; the grid keeps
// its one-per-result shape because cards are short enough to fill it.
const ROW_SKELETON_MAX = 10;

interface ResultsGridProps {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  lastQuery: string;
  pageSize: PageSize;
  viewMode: ViewMode;
  onResultClick: (result: SearchResult) => void;
  onRetry: () => void;
  selection?: ResultSelection;
  sort?: ResultSort;
  onSortChange?: (key: SortKey) => void;
  onAddChannel?: AddChannelHandler;
  onDownloadOne?: (result: SearchResult) => void;
}

function GridSkeleton({ count }: { count: number }) {
  return (
    <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} className="space-y-2">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </Box>
      ))}
    </Box>
  );
}

function RowSkeleton({ count, wide, testId }: { count: number; wide: boolean; testId: string }) {
  return (
    <Box data-testid={testId} className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} className="flex items-center gap-3 py-2 px-1 border-b border-border">
          <Skeleton className="shrink-0 rounded-[var(--radius-thumb)]" style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }} />
          <Box className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </Box>
          {wide && (
            <>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
            </>
          )}
        </Box>
      ))}
    </Box>
  );
}

export default function ResultsGrid({
  results, loading, error, hasSearched, lastQuery, pageSize, viewMode,
  onResultClick, onRetry, selection, sort, onSortChange, onAddChannel, onDownloadOne,
}: ResultsGridProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (loading) {
    if (viewMode === 'grid') return <GridSkeleton count={pageSize} />;
    const rows = Math.min(pageSize, ROW_SKELETON_MAX);
    return isMobile
      ? <RowSkeleton count={rows} wide={false} testId="results-skeleton-list" />
      : <RowSkeleton count={rows} wide testId="results-skeleton-table" />;
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={<Button variant="outlined" onClick={onRetry}>Try again</Button>}
      >
        {error}
      </Alert>
    );
  }

  if (!hasSearched) {
    return (
      <Typography variant="body2" className="text-muted-foreground">
        Enter a search and click Search to find videos on YouTube.
      </Typography>
    );
  }

  if (results.length === 0) {
    return (
      <Typography variant="body2" className="text-muted-foreground">
        No videos found for &quot;{lastQuery}&quot;.
      </Typography>
    );
  }

  if (viewMode === 'table') {
    return isMobile
      ? (
        <ResultsListMobile
          results={results}
          onResultClick={onResultClick}
          selection={selection}
          onAddChannel={onAddChannel}
          onDownloadOne={onDownloadOne}
        />
      )
      : (
        <ResultsTable
          results={results}
          onResultClick={onResultClick}
          selection={selection}
          sort={sort}
          onSortChange={onSortChange}
          onAddChannel={onAddChannel}
          onDownloadOne={onDownloadOne}
        />
      );
  }

  return (
    <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {results.map((r) => (
        <ResultCard
          key={r.youtubeId}
          result={r}
          onClick={() => onResultClick(r)}
          selection={selection}
          onAddChannel={onAddChannel}
          onDownloadOne={onDownloadOne}
        />
      ))}
    </Box>
  );
}
