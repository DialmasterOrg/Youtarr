import React from 'react';
import { Box, Typography, TextField, Button } from '../../ui';
import { Search as SearchIcon, LayoutGrid as ViewModuleIcon, Rows as TableChartIcon } from '../../../lib/icons';
import { VideosViewMode } from '../hooks/useVideosViewMode';

export interface VideosHeaderProps {
  totalVideos: number;
  isMobile: boolean;
  viewMode: VideosViewMode;
  onViewModeChange: (mode: VideosViewMode) => void;
  onSearchChange: (value: string) => void;
}

function VideosHeader({
  totalVideos,
  isMobile,
  viewMode,
  onViewModeChange,
  onSearchChange,
}: VideosHeaderProps) {
  return (
    <Box>
      <Typography
        variant={isMobile ? 'h6' : 'h5'}
        component="h2"
        gutterBottom
        align="center"
      >
        Library ({totalVideos} total)
      </Typography>

      <Box
        className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4"
        style={{ width: '100%' }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search videos by name or channel..."
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon size={16} className="text-muted-foreground" />,
          }}
        />
        <Box
          className="flex shrink-0 self-center rounded-[var(--radius-ui)] overflow-hidden border border-border"
          style={{ height: 40 }}
        >
          {(['table', 'grid'] as const).map((mode) => {
            const isActive = viewMode === mode;
            const Icon = mode === 'table' ? TableChartIcon : ViewModuleIcon;
            const label = mode === 'table' ? 'Table View' : 'Grid View';
            return (
              <Button
                key={mode}
                variant={isActive ? 'contained' : 'text'}
                size="small"
                onClick={() => onViewModeChange(mode)}
                title={label}
                aria-label={label}
                aria-pressed={isActive}
                className="rounded-none"
                style={{ minWidth: 44, height: '100%' }}
              >
                <Icon size={16} />
              </Button>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export default VideosHeader;
