import React from 'react';
import {
  Button,
  Chip,
  Typography,
} from '../../ui';
import { Shield as ShieldIcon } from '../../../lib/icons';
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
  mobileDrawerOpen?: boolean;
  onMobileDrawerClose?: () => void;
  protectedFilter?: boolean;
  onProtectedFilterChange?: (value: boolean) => void;
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
  hideDateFilter = false,
  filtersExpanded = false,
  mobileDrawerOpen = false,
  onMobileDrawerClose,
  protectedFilter = false,
  onProtectedFilterChange,
}: ChannelVideosFiltersProps) {
  const handleClearDuration = () => {
    onMinDurationChange(null);
    onMaxDurationChange(null);
  };

  const handleClearDateRange = () => {
    onDateFromChange(null);
    onDateToChange(null);
  };

  if (isMobile) {
    return (
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
        {hasActiveFilters && (
          <FilterChips
            filters={filters}
            onClearDuration={handleClearDuration}
            onClearDateRange={handleClearDateRange}
          />
        )}

        <MobileFilterDrawer
          open={mobileDrawerOpen}
          onClose={onMobileDrawerClose || (() => undefined)}
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
          protectedFilter={protectedFilter}
          onProtectedFilterChange={onProtectedFilterChange}
        />
      </div>
    );
  }

  // Desktop: Collapsible filter panel (button is in header, controlled by parent)
  return (
    <div style={{ display: filtersExpanded ? 'block' : 'none' }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
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
            <Typography variant="body2" color="text.secondary" style={{ fontStyle: 'italic' }}>
                Shorts do not have date information
              </Typography>
          )}
          {onProtectedFilterChange && (
            <Chip
              icon={<ShieldIcon />}
              label="Protected"
              variant={protectedFilter ? 'filled' : 'outlined'}
              color={protectedFilter ? 'primary' : 'default'}
              size="small"
              onClick={() => onProtectedFilterChange(!protectedFilter)}
              sx={{ cursor: 'pointer' }}
            />
          )}
          {hasActiveFilters && (
            <Button
              size="small"
              onClick={onClearAll}
              style={{ textTransform: 'none' }}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChannelVideosFilters;
