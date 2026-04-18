import React from 'react';
import { Box, Button, TextField, Select, MenuItem } from '../../ui';
import { Loader2, LayoutGrid as ViewModuleIcon, Rows as TableChartIcon } from '../../../lib/icons';
import { PAGE_SIZES, PageSize, ViewMode } from '../types';

interface SearchBarProps {
  query: string;
  pageSize: PageSize;
  loading: boolean;
  viewMode: ViewMode;
  onQueryChange: (q: string) => void;
  onPageSizeChange: (s: PageSize) => void;
  onViewModeChange: (v: ViewMode) => void;
  onSearch: () => void;
  onCancel: () => void;
}

export default function SearchBar({
  query, pageSize, loading, viewMode,
  onQueryChange, onPageSizeChange, onViewModeChange, onSearch, onCancel,
}: SearchBarProps) {
  const trimmed = query.trim();
  const canSearch = !loading && trimmed.length > 0;

  return (
    <Box className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <TextField
        aria-label="Search YouTube"
        placeholder="Search YouTube (e.g. Minecraft)"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSearch) onSearch();
        }}
        disabled={loading}
        className="w-full sm:w-[32rem]"
      />
      <Select
        value={String(pageSize)}
        onValueChange={(v) => onPageSizeChange(Number(v) as PageSize)}
        disabled={loading}
        aria-label="Number of results"
      >
        {PAGE_SIZES.map((n) => (
          <MenuItem key={n} value={String(n)}>{n} results</MenuItem>
        ))}
      </Select>
      {loading ? (
        <Box className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <Button variant="outlined" onClick={onCancel}>Cancel</Button>
        </Box>
      ) : (
        <Button variant="contained" onClick={onSearch} disabled={!canSearch}>Search</Button>
      )}
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
    </Box>
  );
}
