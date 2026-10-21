import React from 'react';
import { Box, Button, TextField, Select, MenuItem } from '../../ui';
import { Loader2, LayoutGrid as ViewModuleIcon, Rows as TableChartIcon } from '../../../lib/icons';
import VideoListSortButton from '../../shared/VideoList/VideoListSortButton';
import { SortConfig } from '../../shared/VideoList/types';
import {
  PAGE_SIZES,
  PageSize,
  ViewMode,
  MinDuration,
  MIN_DURATIONS,
  MIN_DURATION_LABELS,
} from '../types';

interface SearchBarProps {
  query: string;
  pageSize: PageSize;
  minDuration: MinDuration;
  loading: boolean;
  viewMode: ViewMode;
  sort?: SortConfig;
  onQueryChange: (q: string) => void;
  onPageSizeChange: (s: PageSize) => void;
  onMinDurationChange: (d: MinDuration) => void;
  onViewModeChange: (v: ViewMode) => void;
  onSearch: () => void;
  onCancel: () => void;
}

// Phones: the field and Search share the first row, the two selects the second,
// view toggle and sort the third. Wider screens: one wrapping row, with Search
// after the selects. Flex order does the rearranging so nothing renders twice.
const HALF_ROW = 'basis-[calc(50%-0.25rem)] sm:basis-auto';

function ViewToggle({ viewMode, onViewModeChange }: Pick<SearchBarProps, 'viewMode' | 'onViewModeChange'>) {
  return (
    <Box className="flex shrink-0 self-center rounded-[var(--radius-ui)] overflow-hidden border border-border">
      {(['table', 'grid'] as const).map((mode) => {
        const isActive = viewMode === mode;
        const Icon = mode === 'table' ? TableChartIcon : ViewModuleIcon;
        const label = mode === 'table' ? 'Table View' : 'Grid View';
        return (
          <Button
            key={mode}
            variant={isActive ? 'contained' : 'text'}
            size="sm"
            onClick={() => onViewModeChange(mode)}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            className="rounded-none"
          >
            <Icon size={16} />
          </Button>
        );
      })}
    </Box>
  );
}

export default function SearchBar({
  query, pageSize, minDuration, loading, viewMode, sort,
  onQueryChange, onPageSizeChange, onMinDurationChange, onViewModeChange, onSearch, onCancel,
}: SearchBarProps) {
  const trimmed = query.trim();
  const canSearch = !loading && trimmed.length > 0;

  return (
    <Box className="flex flex-wrap items-center gap-2 sm:gap-3">
      <TextField
        aria-label="Search YouTube"
        placeholder="Search YouTube (e.g. Minecraft)"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSearch) onSearch();
        }}
        disabled={loading}
        className="order-1 flex-1 min-w-0 sm:flex-none sm:w-[32rem]"
      />
      <Box className="order-2 sm:order-4 shrink-0">
        {loading ? (
          <Box className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <Button variant="outlined" onClick={onCancel}>Cancel</Button>
          </Box>
        ) : (
          <Button variant="contained" onClick={onSearch} disabled={!canSearch}>Search</Button>
        )}
      </Box>
      <Box className={`order-3 sm:order-2 ${HALF_ROW}`}>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v) as PageSize)}
          disabled={loading}
          aria-label="Number of results"
          fullWidth
        >
          {PAGE_SIZES.map((n) => (
            <MenuItem key={n} value={String(n)}>{n} results</MenuItem>
          ))}
        </Select>
      </Box>
      <Box className={`order-4 sm:order-3 ${HALF_ROW}`}>
        <Select
          value={String(minDuration)}
          onValueChange={(v) => onMinDurationChange(Number(v) as MinDuration)}
          disabled={loading}
          aria-label="Minimum duration"
          fullWidth
        >
          {MIN_DURATIONS.map((d) => (
            <MenuItem key={d} value={String(d)}>{MIN_DURATION_LABELS[d]}</MenuItem>
          ))}
        </Select>
      </Box>
      <Box className="order-5 flex items-center gap-2">
        <ViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
        {sort && <VideoListSortButton sort={sort} />}
      </Box>
    </Box>
  );
}
