import React, { useState } from 'react';
import {
  Box,
  Button,
  Badge,
  Collapse,
  Typography,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import DurationFilterInput from './DurationFilterInput';
import DateRangeFilterInput from './DateRangeFilterInput';
import FilterChips from './FilterChips';
import MobileFilterDrawer from './MobileFilterDrawer';
import { VideoFilters } from '../hooks/useChannelVideoFilters';

interface ChannelVideosFiltersProps {
  isMobile: boolean;
  filters: VideoFilters;
  inputMinDuration: number | null; // Immediate input value for responsive display
  inputMaxDuration: number | null; // Immediate input value for responsive display
  onMinDurationChange: (value: number | null) => void;
  onMaxDurationChange: (value: number | null) => void;
  onDateFromChange: (value: Date | null) => void;
  onDateToChange: (value: Date | null) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  hideDateFilter?: boolean;
  filtersExpanded?: boolean; // For desktop, controlled by parent
}

function ChannelVideosFilters({
  isMobile,
  filters,
  inputMinDuration,
  inputMaxDuration,
  onMinDurationChange,
  onMaxDurationChange,
  onDateFromChange,
  onDateToChange,
  onClearAll,
  hasActiveFilters,
  activeFilterCount,
  hideDateFilter = false,
  filtersExpanded = false,
}: ChannelVideosFiltersProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleClearDuration = () => {
    onMinDurationChange(null);
    onMaxDurationChange(null);
  };

  const handleClearDateRange = () => {
    onDateFromChange(null);
    onDateToChange(null);
  };

  // Mobile: Show filter button that opens drawer
  if (isMobile) {
    return (
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={
              <Badge badgeContent={activeFilterCount} color="primary" invisible={activeFilterCount === 0}>
                <FilterListIcon />
              </Badge>
            }
            onClick={() => setDrawerOpen(true)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Filters
          </Button>

          {/* Show active filter chips on mobile too */}
          {hasActiveFilters && (
            <FilterChips
              filters={filters}
              onClearDuration={handleClearDuration}
              onClearDateRange={handleClearDateRange}
            />
          )}
        </Box>

        <MobileFilterDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          filters={filters}
          inputMinDuration={inputMinDuration}
          inputMaxDuration={inputMaxDuration}
          onMinDurationChange={onMinDurationChange}
          onMaxDurationChange={onMaxDurationChange}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
          onClearAll={onClearAll}
          hasActiveFilters={hasActiveFilters}
          hideDateFilter={hideDateFilter}
        />
      </Box>
    );
  }

  // Desktop: Collapsible filter panel (button is in header, controlled by parent)
  return (
    <Collapse in={filtersExpanded}>
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <DurationFilterInput
            minDuration={inputMinDuration}
            maxDuration={inputMaxDuration}
            onMinChange={onMinDurationChange}
            onMaxChange={onMaxDurationChange}
          />
          {!hideDateFilter ? (
            <DateRangeFilterInput
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onFromChange={onDateFromChange}
              onToChange={onDateToChange}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Shorts do not have date information
            </Typography>
          )}
          {hasActiveFilters && (
            <Button
              size="small"
              onClick={onClearAll}
              sx={{ textTransform: 'none' }}
            >
              Clear All
            </Button>
          )}
        </Box>
      </Box>
    </Collapse>
  );
}

export default ChannelVideosFilters;
