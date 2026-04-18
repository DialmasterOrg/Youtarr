import React from 'react';
import { Box, Typography, Alert, Button, Skeleton } from '../../ui';
import { SearchResult, PageSize } from '../types';
import ResultCard from './ResultCard';

interface ResultsGridProps {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  lastQuery: string;
  pageSize: PageSize;
  onResultClick: (result: SearchResult) => void;
  onRetry: () => void;
}

export default function ResultsGrid({
  results, loading, error, hasSearched, lastQuery, pageSize, onResultClick, onRetry,
}: ResultsGridProps) {
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

  return (
    <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {results.map((r) => (
        <ResultCard key={r.youtubeId} result={r} onClick={() => onResultClick(r)} />
      ))}
    </Box>
  );
}
