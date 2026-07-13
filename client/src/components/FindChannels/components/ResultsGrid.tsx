import React from 'react';
import { Alert, Box, Button, Skeleton, Typography } from '../../ui';
import { ChannelSearchResult, PageSize } from '../types';
import ChannelCard from './ChannelCard';

interface ResultsGridProps {
  results: ChannelSearchResult[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  lastQuery: string;
  pageSize: PageSize;
  onResultClick: (result: ChannelSearchResult) => void;
  onRetry: () => void;
}

const GRID_CLASSES = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';

export default function ResultsGrid({
  results, loading, error, hasSearched, lastQuery, pageSize, onResultClick, onRetry,
}: ResultsGridProps) {
  if (loading) {
    return (
      <Box className={GRID_CLASSES}>
        {Array.from({ length: pageSize }).map((_, i) => (
          <Box key={i} className="space-y-2 p-3">
            <Skeleton className="h-20 w-20 rounded-full mx-auto" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-3 w-1/2 mx-auto" />
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
        Enter a search and click Search to find channels on YouTube.
      </Typography>
    );
  }

  if (results.length === 0) {
    return (
      <Typography variant="body2" className="text-muted-foreground">
        No channels found for &quot;{lastQuery}&quot;.
      </Typography>
    );
  }

  return (
    <Box className={GRID_CLASSES}>
      {results.map((r) => (
        <ChannelCard key={r.channelId} result={r} onClick={() => onResultClick(r)} />
      ))}
    </Box>
  );
}
