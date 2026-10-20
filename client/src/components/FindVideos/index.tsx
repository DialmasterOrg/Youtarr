import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVideoActivity } from '../../providers/VideoActivityProvider';
import { useLocalVideoStatus } from '../../hooks/useLocalVideoStatus';
import { removedState } from '../../utils/videoRemoval';
import { Alert, Box, Typography } from '../ui';
import { Download as DownloadIcon } from '../../lib/icons';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';
import AddChannelDialog from '../shared/AddChannelDialog';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useConfig } from '../../hooks/useConfig';
import { useVideoSelection } from '../shared/VideoList/hooks/useVideoSelection';
import VideoListSelectionPill from '../shared/VideoList/VideoListSelectionPill';
import { SelectionAction, SortConfig } from '../shared/VideoList/types';
import DownloadSettingsDialog from '../DownloadManager/ManualDownload/DownloadSettingsDialog';
import SearchBar from './components/SearchBar';
import ResultsGrid from './components/ResultsGrid';
import { useVideoSearch } from './hooks/useVideoSearch';
import { useFindVideosPreferences } from './hooks/useFindVideosPreferences';
import { useResultDownload } from './hooks/useResultDownload';
import { DEFAULT_SORT, defaultDirectionFor, isSortKey, SORT_OPTIONS, SortKey, sortResults } from './sortResults';
import {
  DEFAULT_PAGE_SIZE,
  isSelectableForDownload,
  PageSize,
  ResultSelection,
  SearchResult,
} from './types';

const QUERY_PARAM = 'q';

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
    status: r.status === 'queued' || r.status === 'downloading'
      ? (r.isDownloaded ? 'downloaded' : r.databaseId ? removedState(r.removedReason) : 'never_downloaded')
      : r.status,
    inArchive: r.inArchive,
    removal: { reason: r.removedReason ?? null, at: r.removedAt ?? null, detail: r.removedDetail ?? null },
    isDownloaded: r.isDownloaded ?? r.status === 'downloaded',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get(QUERY_PARAM);
  const prefs = useFindVideosPreferences();
  const { results: searchResults, loading, error, restored, search, cancel } = useVideoSearch(token, { restoreQuery: urlQuery });
  const [query, setQuery] = useState(restored?.query ?? urlQuery ?? '');
  const [pageSize, setPageSize] = useState<PageSize>(restored?.count ?? DEFAULT_PAGE_SIZE);
  const [hasSearched, setHasSearched] = useState(Boolean(restored));
  const [modalVideo, setModalVideo] = useState<VideoModalData | null>(null);
  const [addChannel, setAddChannel] = useState<{ name: string; url: string } | null>(null);
  const lastQueryRef = useRef(restored?.query ?? '');
  const lastPageSizeRef = useRef<PageSize>(restored?.count ?? DEFAULT_PAGE_SIZE);

  const { snapshot } = useVideoActivity();
  const localStatuses = useLocalVideoStatus(searchResults.map(r => r.youtubeId), token);
  const results = useMemo(() => searchResults.map(result => ({
    ...result,
    ...localStatuses[result.youtubeId],
    isDownloaded: (localStatuses[result.youtubeId]?.status || result.status) === 'downloaded',
    status: snapshot.videos[result.youtubeId]?.state || localStatuses[result.youtubeId]?.status || result.status,
  })), [searchResults, localStatuses, snapshot]);
  const { config } = useConfig(token);

  const runSearch = useCallback((trimmed: string, count: PageSize) => {
    lastQueryRef.current = trimmed;
    lastPageSizeRef.current = count;
    setHasSearched(true);
    setSearchParams({ [QUERY_PARAM]: trimmed }, { replace: true });
    search(trimmed, count);
  }, [search, setSearchParams]);

  // Opened with ?q= and nothing remembered for it (a fresh tab, a shared link):
  // run that search once. Only the query the page was opened with counts; the
  // ones it writes to the URL itself must not trigger a second search.
  const openedWithQuery = useRef(urlQuery);
  useEffect(() => {
    const initial = openedWithQuery.current?.trim();
    if (restored || !initial) return;
    runSearch(initial, pageSize);
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

  const filteredResults = useMemo(() => {
    if (prefs.minDuration === 0) return results;
    return results.filter((r) => r.duration === null || r.duration >= prefs.minDuration);
  }, [results, prefs.minDuration]);
  const sortedResults = useMemo(
    () => sortResults(filteredResults, prefs.sort.key, prefs.sort.direction),
    [filteredResults, prefs.sort]
  );

  const showFilterCount =
    hasSearched && !loading && !error && prefs.minDuration !== 0 && results.length > 0;
  const allFilteredOut =
    showFilterCount && results.length > 0 && filteredResults.length === 0;

  // The selection's Download action opens the dialog, and the dialog hook needs
  // the selection: the ref breaks the loop.
  const openForSelectionRef = useRef<() => void>(() => {});
  const downloadActions: SelectionAction<string>[] = useMemo(
    () => [
      {
        id: 'download',
        label: 'Download',
        icon: <DownloadIcon size={14} />,
        intent: 'success',
        onClick: () => openForSelectionRef.current(),
      },
    ],
    []
  );

  const selection = useVideoSelection<string>({ actions: downloadActions });
  const download = useResultDownload({ token, results, selection, activeVideos: snapshot.videos });
  openForSelectionRef.current = download.openForSelection;

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

  // Column headers cycle: the column's natural direction, the other, then back to relevance.
  const handleHeaderSort = useCallback((key: SortKey) => {
    const { sort, setSort } = prefs;
    if (sort.key !== key) {
      setSort({ key, direction: defaultDirectionFor(key) });
    } else if (sort.direction === defaultDirectionFor(key)) {
      setSort({ key, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort(DEFAULT_SORT);
    }
  }, [prefs]);

  // The desktop table sorts through its headers; every other layout gets the menu.
  const showSortMenu = isMobile || prefs.viewMode === 'grid';
  const sortConfig: SortConfig | undefined = showSortMenu
    ? {
      options: SORT_OPTIONS,
      activeKey: prefs.sort.key,
      direction: prefs.sort.direction,
      onChange: (key, direction) => {
        if (isSortKey(key)) prefs.setSort({ key, direction });
      },
    }
    : undefined;

  const defaultResolution = config.preferredResolution || '1080';

  return (
    <Box className="flex flex-col gap-4 py-4">
      <Typography variant="h5">Find Videos on YouTube</Typography>
      <SearchBar
        query={query}
        pageSize={pageSize}
        minDuration={prefs.minDuration}
        loading={loading}
        viewMode={prefs.viewMode}
        sort={sortConfig}
        onQueryChange={setQuery}
        onPageSizeChange={setPageSize}
        onMinDurationChange={prefs.setMinDuration}
        onViewModeChange={prefs.setViewMode}
        onSearch={doSearch}
        onCancel={cancel}
      />
      {showFilterCount && (
        <Typography variant="body2" className="text-muted-foreground">
          Showing {filteredResults.length} of {results.length} results (
          {results.length - filteredResults.length} hidden by minimum duration filter)
        </Typography>
      )}
      {download.error && (
        <Alert severity="error" onClose={download.clearError}>
          {download.error}
        </Alert>
      )}
      {allFilteredOut ? (
        <Typography variant="body2" className="text-muted-foreground">
          All {results.length} results were hidden by the minimum duration filter. Try
          lowering it to see more.
        </Typography>
      ) : (
        <ResultsGrid
          results={sortedResults}
          loading={loading}
          error={error}
          hasSearched={hasSearched}
          lastQuery={lastQueryRef.current}
          pageSize={pageSize}
          viewMode={prefs.viewMode}
          onResultClick={(r) => setModalVideo(toModalData(r))}
          onRetry={onRetry}
          selection={resultSelection}
          sort={prefs.sort}
          onSortChange={handleHeaderSort}
          onAddChannel={(name, url) => setAddChannel({ name, url })}
          onDownloadOne={download.openForOne}
        />
      )}
      <VideoListSelectionPill selection={selection} isMobile={isMobile} />
      <DownloadSettingsDialog
        open={download.dialogOpen}
        onClose={download.close}
        onConfirm={download.confirm}
        videoCount={download.targetIds.length}
        missingVideoCount={download.missingVideoCount}
        defaultResolution={defaultResolution}
        defaultResolutionSource="global"
        mode="manual"
        token={token}
      />
      {addChannel && (
        <AddChannelDialog
          open
          onClose={() => setAddChannel(null)}
          channelName={addChannel.name}
          channelUrl={addChannel.url}
        />
      )}
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
