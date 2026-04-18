import React from 'react';
import { Box, Button, TextField, Select, MenuItem } from '../../ui';
import { Loader2 } from '../../../lib/icons';
import { PAGE_SIZES, PageSize } from '../types';

interface SearchBarProps {
  query: string;
  pageSize: PageSize;
  loading: boolean;
  onQueryChange: (q: string) => void;
  onPageSizeChange: (s: PageSize) => void;
  onSearch: () => void;
  onCancel: () => void;
}

export default function SearchBar({
  query, pageSize, loading,
  onQueryChange, onPageSizeChange, onSearch, onCancel,
}: SearchBarProps) {
  const trimmed = query.trim();
  const canSearch = !loading && trimmed.length > 0;

  return (
    <Box className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <TextField
        aria-label="Search YouTube"
        placeholder="Search YouTube (e.g. Minecraft)"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSearch) onSearch();
        }}
        disabled={loading}
        className="flex-1"
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
        <Button onClick={onSearch} disabled={!canSearch}>Search</Button>
      )}
    </Box>
  );
}
