import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography } from '../ui';
import AddChannelDialog from '../shared/AddChannelDialog';
import SearchBar from './components/SearchBar';
import ResultsGrid from './components/ResultsGrid';
import { useChannelSearch } from './hooks/useChannelSearch';
import { ChannelSearchResult, DEFAULT_PAGE_SIZE, PageSize } from './types';

interface FindChannelsProps {
  token: string | null;
}

export default function FindChannels({ token }: FindChannelsProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [hasSearched, setHasSearched] = useState(false);
  const [addChannelTarget, setAddChannelTarget] = useState<{ name: string; url: string } | null>(null);
  const lastQueryRef = useRef('');
  const lastPageSizeRef = useRef<PageSize>(DEFAULT_PAGE_SIZE);

  const { results, loading, error, search, cancel } = useChannelSearch(token);

  const doSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    lastQueryRef.current = trimmed;
    lastPageSizeRef.current = pageSize;
    setHasSearched(true);
    search(trimmed, pageSize);
  }, [query, pageSize, search]);

  const onRetry = useCallback(() => {
    if (!lastQueryRef.current) return;
    search(lastQueryRef.current, lastPageSizeRef.current);
  }, [search]);

  const onResultClick = useCallback((r: ChannelSearchResult) => {
    if (r.subscribed) {
      navigate(`/channel/${r.channelId}`);
    } else {
      setAddChannelTarget({ name: r.name, url: r.url });
    }
  }, [navigate]);

  return (
    <Box className="flex flex-col gap-4 py-4">
      <Typography variant="h5">Find on YouTube</Typography>
      <SearchBar
        query={query}
        pageSize={pageSize}
        loading={loading}
        onQueryChange={setQuery}
        onPageSizeChange={setPageSize}
        onSearch={doSearch}
        onCancel={cancel}
      />
      <ResultsGrid
        results={results}
        loading={loading}
        error={error}
        hasSearched={hasSearched}
        lastQuery={lastQueryRef.current}
        pageSize={pageSize}
        onResultClick={onResultClick}
        onRetry={onRetry}
      />

      {addChannelTarget && (
        <AddChannelDialog
          open
          onClose={() => setAddChannelTarget(null)}
          channelName={addChannelTarget.name}
          channelUrl={addChannelTarget.url}
        />
      )}
    </Box>
  );
}
