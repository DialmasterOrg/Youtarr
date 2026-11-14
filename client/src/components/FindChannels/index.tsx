import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography } from '../ui';
import AddChannelDialog from '../shared/AddChannelDialog';
import SearchBar from './components/SearchBar';
import ResultsGrid from './components/ResultsGrid';
import { useChannelSearch } from './hooks/useChannelSearch';
import { ChannelSearchResult, DEFAULT_PAGE_SIZE, PageSize } from './types';

const QUERY_PARAM = 'q';

interface FindChannelsProps {
  token: string | null;
}

export default function FindChannels({ token }: FindChannelsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Only the query the page was opened with counts; the ones it writes to the
  // URL itself must not trigger a second search.
  const openedWithQuery = useRef((searchParams.get(QUERY_PARAM) ?? '').trim());
  const [query, setQuery] = useState(openedWithQuery.current);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [hasSearched, setHasSearched] = useState(false);
  const [addChannelTarget, setAddChannelTarget] = useState<{ name: string; url: string } | null>(null);
  const lastQueryRef = useRef('');
  const lastPageSizeRef = useRef<PageSize>(DEFAULT_PAGE_SIZE);

  const { results, loading, error, search, cancel } = useChannelSearch(token);

  const runSearch = useCallback((trimmed: string, count: PageSize) => {
    lastQueryRef.current = trimmed;
    lastPageSizeRef.current = count;
    setHasSearched(true);
    setSearchParams({ [QUERY_PARAM]: trimmed }, { replace: true });
    search(trimmed, count);
  }, [search, setSearchParams]);

  // Opened with ?q= (the Channels page hands a name over this way): run it once.
  useEffect(() => {
    if (!openedWithQuery.current) return;
    runSearch(openedWithQuery.current, DEFAULT_PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    runSearch(trimmed, pageSize);
  }, [query, pageSize, runSearch]);

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
      <Typography variant="h5">Find Channels on YouTube</Typography>
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
