import React from 'react';
import { Box, Typography, Alert, Button, Skeleton } from '../../ui';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { ResultSelection, SearchResult, PageSize, ViewMode } from '../types';
import ResultCard from './ResultCard';
import ResultsTable from './ResultsTable';
import ResultsListMobile from './ResultsListMobile';

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
}

export default function ResultsGrid({
  results, loading, error, hasSearched, lastQuery, pageSize, viewMode, onResultClick, onRetry, selection,
}: ResultsGridProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (loading) {
    return (
      <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: pageSize }).map((_, i) => (
          <Box key={i} className="space-y-2">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </Box>
        ))}
      </Box>
    );
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
      ? <ResultsListMobile results={results} onResultClick={onResultClick} selection={selection} />
      : <ResultsTable results={results} onResultClick={onResultClick} selection={selection} />;
  }

  return (
    <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {results.map((r) => (
        <ResultCard
          key={r.youtubeId}
          result={r}
          onClick={() => onResultClick(r)}
          selection={selection}
        />
      ))}
    </Box>
  );
}
