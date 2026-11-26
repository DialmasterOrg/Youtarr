import { useState, useMemo, useCallback, Dispatch, SetStateAction } from 'react';
import {
  INFINITE_SCROLL_FETCH_SIZE,
  useListPageSize,
  type ChipFilterMode,
  type FilterConfig,
  type PageSize,
} from '../../shared/VideoList';
import { useChannelVideoFilters } from './useChannelVideoFilters';

export type ChannelVideoSortBy = 'date' | 'title' | 'duration' | 'size';
export type ChannelVideoSortOrder = 'asc' | 'desc';

const PAGE_SIZE_STORAGE_KEY = 'youtarr.channelVideos.pageSize';

export interface ChannelVideoFilterValues {
  minDuration: number | null;
  maxDuration: number | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  maxRating: string;
  downloadedFilter: ChipFilterMode;
  protectedFilter: ChipFilterMode;
  missingFilter: ChipFilterMode;
  deletedFilter: ChipFilterMode;
  ignoredFilter: ChipFilterMode;
  watchedFilter: ChipFilterMode;
}

interface UseChannelVideoQueryParams {
  channelId: string | undefined;
  selectedTab: string | null;
  // The debounced search text.
  search: string;
  useInfiniteScroll: boolean;
}

interface UseChannelVideoQueryResult {
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: PageSize;
  // The size requested from the server: infinite scroll loads fixed chunks.
  effectivePageSize: number;
  changePageSize: (newSize: PageSize) => void;
  sortBy: ChannelVideoSortBy;
  sortOrder: ChannelVideoSortOrder;
  changeSort: (newSortBy: ChannelVideoSortBy) => void;
  // A new object whenever a filter value changes, and only then.
  filters: ChannelVideoFilterValues;
  filterConfigs: FilterConfig[];
  // A search or filter is narrowing the list.
  isFiltered: boolean;
  // Changes whenever the list has to restart from its first page.
  resetKey: string;
  resetForTabChange: () => void;
}

// What the channel video list is asked to show: filters, sort and page.
export function useChannelVideoQuery({
  channelId,
  selectedTab,
  search,
  useInfiniteScroll,
}: UseChannelVideoQueryParams): UseChannelVideoQueryResult {
  const [sortBy, setSortBy] = useState<ChannelVideoSortBy>('date');
  const [sortOrder, setSortOrder] = useState<ChannelVideoSortOrder>('desc');
  const [maxRating, setMaxRating] = useState('');
  const [downloadedFilter, setDownloadedFilter] = useState<ChipFilterMode>('off');
  const [protectedFilter, setProtectedFilter] = useState<ChipFilterMode>('off');
  const [missingFilter, setMissingFilter] = useState<ChipFilterMode>('off');
  const [deletedFilter, setDeletedFilter] = useState<ChipFilterMode>('off');
  const [ignoredFilter, setIgnoredFilter] = useState<ChipFilterMode>('off');
  const [watchedFilter, setWatchedFilter] = useState<ChipFilterMode>('off');
  const [pageSize, setPageSize] = useListPageSize(PAGE_SIZE_STORAGE_KEY);
  const [page, setPage] = useState(1);

  const {
    filters: { minDuration, maxDuration, dateFrom, dateTo },
    inputMinDuration,
    inputMaxDuration,
    setMinDuration,
    setMaxDuration,
    setDateFrom,
    setDateTo,
    clearAllFilters: clearDurationAndDateFilters,
    hasActiveFilters: hasDurationOrDateFilter,
  } = useChannelVideoFilters();

  const filters = useMemo<ChannelVideoFilterValues>(
    () => ({
      minDuration,
      maxDuration,
      dateFrom,
      dateTo,
      maxRating,
      downloadedFilter,
      protectedFilter,
      missingFilter,
      deletedFilter,
      ignoredFilter,
      watchedFilter,
    }),
    [
      minDuration,
      maxDuration,
      dateFrom,
      dateTo,
      maxRating,
      downloadedFilter,
      protectedFilter,
      missingFilter,
      deletedFilter,
      ignoredFilter,
      watchedFilter,
    ]
  );

  const resetKey = [
    channelId || '',
    selectedTab || '',
    downloadedFilter,
    search,
    sortBy,
    sortOrder,
    maxRating,
    minDuration,
    maxDuration,
    dateFrom ? dateFrom.toISOString() : '',
    dateTo ? dateTo.toISOString() : '',
    protectedFilter,
    missingFilter,
    deletedFilter,
    ignoredFilter,
    watchedFilter,
    useInfiniteScroll,
  ].join('|');

  // Back to the first page in the same render as the change. An effect would
  // first commit the old page with the new query, and the list would request
  // that before the first page.
  const [pageResetKey, setPageResetKey] = useState(resetKey);
  if (pageResetKey !== resetKey) {
    setPageResetKey(resetKey);
    setPage(1);
  }

  const changePageSize = useCallback(
    (newSize: PageSize) => {
      setPageSize(newSize);
      setPage(1);
    },
    [setPageSize]
  );

  const changeSort = useCallback(
    (newSortBy: ChannelVideoSortBy) => {
      if (sortBy === newSortBy) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(newSortBy);
        setSortOrder('desc');
      }
      setPage(1);
    },
    [sortBy, sortOrder]
  );

  // Sort, search and the rating limit carry over to the new tab.
  const resetForTabChange = useCallback(() => {
    setPage(1);
    clearDurationAndDateFilters();
    setProtectedFilter('off');
    setMissingFilter('off');
    setDeletedFilter('off');
    setIgnoredFilter('off');
    setWatchedFilter('off');
    setDownloadedFilter('off');
  }, [clearDurationAndDateFilters]);

  const filterConfigs = useMemo<FilterConfig[]>(
    () => [
      {
        id: 'duration',
        min: minDuration,
        max: maxDuration,
        inputMin: inputMinDuration,
        inputMax: inputMaxDuration,
        onMinChange: setMinDuration,
        onMaxChange: setMaxDuration,
      },
      {
        id: 'dateRange',
        dateFrom,
        dateTo,
        onFromChange: setDateFrom,
        onToChange: setDateTo,
        hidden: selectedTab === 'shorts',
        hiddenReason: selectedTab === 'shorts' ? 'Shorts do not have date information' : undefined,
      },
      { id: 'maxRating', value: maxRating, onChange: setMaxRating },
      { id: 'protected', value: protectedFilter, onChange: setProtectedFilter },
      { id: 'missing', value: missingFilter, onChange: setMissingFilter },
      { id: 'deleted', value: deletedFilter, onChange: setDeletedFilter },
      { id: 'ignored', value: ignoredFilter, onChange: setIgnoredFilter },
      { id: 'downloaded', value: downloadedFilter, onChange: setDownloadedFilter },
      { id: 'watched', value: watchedFilter, onChange: setWatchedFilter },
    ],
    [
      minDuration,
      maxDuration,
      dateFrom,
      dateTo,
      inputMinDuration,
      inputMaxDuration,
      setMinDuration,
      setMaxDuration,
      setDateFrom,
      setDateTo,
      maxRating,
      protectedFilter,
      missingFilter,
      deletedFilter,
      ignoredFilter,
      watchedFilter,
      downloadedFilter,
      selectedTab,
    ]
  );

  const isFiltered =
    Boolean(search) ||
    hasDurationOrDateFilter ||
    maxRating !== '' ||
    [downloadedFilter, protectedFilter, missingFilter, deletedFilter, ignoredFilter, watchedFilter].some(
      (mode) => mode !== 'off'
    );

  return {
    page,
    setPage,
    pageSize,
    effectivePageSize: useInfiniteScroll ? INFINITE_SCROLL_FETCH_SIZE : pageSize,
    changePageSize,
    sortBy,
    sortOrder,
    changeSort,
    filters,
    filterConfigs,
    isFiltered,
    resetKey,
    resetForTabChange,
  };
}
