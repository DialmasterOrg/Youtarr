import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Typography } from '../ui';
import { Download as DownloadIcon } from '../../lib/icons';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useConfig } from '../../hooks/useConfig';
import { useTriggerDownloads } from '../../hooks/useTriggerDownloads';
import { useVideoSelection } from '../shared/VideoList/hooks/useVideoSelection';
import VideoListSelectionPill from '../shared/VideoList/VideoListSelectionPill';
import { SelectionAction } from '../shared/VideoList/types';
import DownloadSettingsDialog from '../DownloadManager/ManualDownload/DownloadSettingsDialog';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';
import SearchBar from './components/SearchBar';
import ResultsGrid from './components/ResultsGrid';
import { useVideoSearch } from './hooks/useVideoSearch';
import {
  DEFAULT_MIN_DURATION,
  DEFAULT_PAGE_SIZE,
  isSelectableForDownload,
  MIN_DURATIONS,
  MIN_DURATION_STORAGE_KEY,
  MinDuration,
  PageSize,
  ResultSelection,
  SearchResult,
  ViewMode,
} from './types';

function readStoredMinDuration(): MinDuration {
  try {
    const raw = window.localStorage.getItem(MIN_DURATION_STORAGE_KEY);
    if (raw === null) return DEFAULT_MIN_DURATION;
    const parsed = Number(raw) as MinDuration;
    return MIN_DURATIONS.includes(parsed) ? parsed : DEFAULT_MIN_DURATION;
  } catch {
    return DEFAULT_MIN_DURATION;
  }
}

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
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [minDuration, setMinDuration] = useState<MinDuration>(readStoredMinDuration);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'table' : 'grid');
  const [modalVideo, setModalVideo] = useState<VideoModalData | null>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const lastQueryRef = useRef('');
  const lastPageSizeRef = useRef<PageSize>(DEFAULT_PAGE_SIZE);

  const { results, loading, error, search, cancel } = useVideoSearch(token);
  const { config } = useConfig(token);
  const { triggerDownloads } = useTriggerDownloads(token);

  useEffect(() => {
    try {
      window.localStorage.setItem(MIN_DURATION_STORAGE_KEY, String(minDuration));
    } catch {
      // localStorage unavailable (private mode, quota); filter still works in-session.
    }
  }, [minDuration]);

  const filteredResults = useMemo(() => {
    if (minDuration === 0) return results;
    return results.filter((r) => r.duration === null || r.duration >= minDuration);
  }, [results, minDuration]);

  const doSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setDownloadError(null);
    lastQueryRef.current = trimmed;
    lastPageSizeRef.current = pageSize;
    setHasSearched(true);
    search(trimmed, pageSize);
  }, [query, pageSize, search]);

  const onRetry = useCallback(() => {
    if (!lastQueryRef.current) return;
    search(lastQueryRef.current, lastPageSizeRef.current);
  }, [search]);

  const showFilterCount =
    hasSearched && !loading && !error && minDuration !== 0 && results.length > 0;
  const allFilteredOut =
    showFilterCount && results.length > 0 && filteredResults.length === 0;

  const downloadActions: SelectionAction<string>[] = useMemo(
    () => [
      {
        id: 'download',
        label: 'Download',
        icon: <DownloadIcon size={14} />,
        intent: 'success',
        onClick: () => {
          setDownloadError(null);
          setDownloadDialogOpen(true);
        },
      },
    ],
    []
  );

  const selection = useVideoSelection<string>({ actions: downloadActions });

  // Drop selected ids that are no longer eligible (e.g. their status changed,
  // or a new search wiped them from the results list).
  useEffect(() => {
    if (selection.selectedIds.length === 0) return;
    const eligibleIds = new Set(
      results.filter((r) => isSelectableForDownload(r.status)).map((r) => r.youtubeId)
    );
    const stillValid = selection.selectedIds.filter((id) => eligibleIds.has(id));
    if (stillValid.length !== selection.selectedIds.length) selection.set(stillValid);
  }, [results, selection.selectedIds, selection.set]);

  const resultSelection: ResultSelection = useMemo(
    () => ({
      isChecked: (id: string) => selection.isSelected(id),
      toggle: (id: string) => selection.toggle(id),
    }),
    [selection.isSelected, selection.toggle]
  );

  const handleDownloadConfirm = useCallback(
    async (settings: DownloadSettings | null) => {
      setDownloadDialogOpen(false);
      const ids = selection.selectedIds;
      if (ids.length === 0) return;
      const urls = ids.map((id) => `https://www.youtube.com/watch?v=${id}`);
      const overrideSettings = settings
        ? {
            resolution: settings.resolution,
            allowRedownload: settings.allowRedownload,
            subfolder: settings.subfolder,
            audioFormat: settings.audioFormat,
            rating: settings.rating,
            skipVideoFolder: settings.skipVideoFolder,
          }
        : undefined;
      const success = await triggerDownloads({ urls, overrideSettings });
      if (!success) {
        setDownloadError('Failed to queue selected videos. Please try again.');
        return;
      }
      selection.clear();
      navigate('/downloads/activity');
    },
    [selection, triggerDownloads, navigate]
  );

  const missingVideoCount = useMemo(
    () => results.filter((r) => selection.isSelected(r.youtubeId) && r.status === 'missing').length,
    [results, selection.isSelected]
  );
  const defaultResolution = config.preferredResolution || '1080';

  return (
    <Box className="flex flex-col gap-4 py-4">
      <Typography variant="h5">Find on YouTube</Typography>
      <SearchBar
        query={query}
        pageSize={pageSize}
        minDuration={minDuration}
        loading={loading}
        viewMode={viewMode}
        onQueryChange={setQuery}
        onPageSizeChange={setPageSize}
        onMinDurationChange={setMinDuration}
        onViewModeChange={setViewMode}
        onSearch={doSearch}
        onCancel={cancel}
      />
      {showFilterCount && (
        <Typography variant="body2" className="text-muted-foreground">
          Showing {filteredResults.length} of {results.length} results (
          {results.length - filteredResults.length} hidden by minimum duration filter)
        </Typography>
      )}
      {downloadError && (
        <Alert severity="error" onClose={() => setDownloadError(null)}>
          {downloadError}
        </Alert>
      )}
      {allFilteredOut ? (
        <Typography variant="body2" className="text-muted-foreground">
          All {results.length} results were hidden by the minimum duration filter. Try
          lowering it to see more.
        </Typography>
      ) : (
        <ResultsGrid
          results={filteredResults}
          loading={loading}
          error={error}
          hasSearched={hasSearched}
          lastQuery={lastQueryRef.current}
          pageSize={pageSize}
          viewMode={viewMode}
          onResultClick={(r) => setModalVideo(toModalData(r))}
          onRetry={onRetry}
          selection={resultSelection}
        />
      )}
      <VideoListSelectionPill selection={selection} isMobile={isMobile} />
      <DownloadSettingsDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        onConfirm={handleDownloadConfirm}
        videoCount={selection.selectedIds.length}
        missingVideoCount={missingVideoCount}
        defaultResolution={defaultResolution}
        defaultResolutionSource="global"
        mode="manual"
        token={token}
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
