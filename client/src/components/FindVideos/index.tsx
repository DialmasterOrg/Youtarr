import React, { useCallback, useRef, useState } from 'react';
import { Box, Typography } from '../ui';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import SearchBar from './components/SearchBar';
import ResultsGrid from './components/ResultsGrid';
import { useVideoSearch } from './hooks/useVideoSearch';
import { DEFAULT_PAGE_SIZE, PageSize, SearchResult, ViewMode } from './types';

interface FindVideosProps {
  token: string | null;
}

function toModalData(r: SearchResult): VideoModalData {
  return {
    youtubeId: r.youtubeId,
    title: r.title,
    channelName: r.channelName,
    thumbnailUrl: r.thumbnailUrl || '',
    duration: r.duration,
    publishedAt: r.publishedAt,
    addedAt: r.addedAt ?? null,
    mediaType: 'video',
    status: r.status,
    isDownloaded: r.status === 'downloaded',
    filePath: r.filePath ?? null,
    fileSize: r.fileSize ?? null,
    audioFilePath: r.audioFilePath ?? null,
    audioFileSize: r.audioFileSize ?? null,
    isProtected: r.isProtected ?? false,
    isIgnored: false,
    normalizedRating: r.normalizedRating ?? null,
    ratingSource: r.ratingSource ?? null,
    databaseId: r.databaseId ?? null,
    channelId: r.channelId,
  };
}

export default function FindVideos({ token }: FindVideosProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'table' : 'grid');
  const [modalVideo, setModalVideo] = useState<VideoModalData | null>(null);
  const lastQueryRef = useRef('');
  const lastPageSizeRef = useRef<PageSize>(DEFAULT_PAGE_SIZE);

  const { results, loading, error, search, cancel } = useVideoSearch(token);

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

  return (
    <Box className="flex flex-col gap-4 py-4">
      <Typography variant="h5">Find on YouTube</Typography>
      <SearchBar
        query={query}
        pageSize={pageSize}
        loading={loading}
        viewMode={viewMode}
        onQueryChange={setQuery}
        onPageSizeChange={setPageSize}
        onViewModeChange={setViewMode}
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
        viewMode={viewMode}
        onResultClick={(r) => setModalVideo(toModalData(r))}
        onRetry={onRetry}
      />
      {modalVideo && (
        <VideoModal
          open
          onClose={() => setModalVideo(null)}
          video={modalVideo}
          token={token}
          allowIgnore={false}
        />
      )}
    </Box>
  );
}
