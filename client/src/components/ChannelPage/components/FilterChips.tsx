import React from 'react';
import { Box, Chip } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { VideoFilters } from '../hooks/useChannelVideoFilters';

interface FilterChipsProps {
  filters: VideoFilters;
  onClearDuration: () => void;
  onClearDateRange: () => void;
}

function formatDurationLabel(minDuration: number | null, maxDuration: number | null): string {
  if (minDuration !== null && maxDuration !== null) {
    return `${minDuration}-${maxDuration} min`;
  } else if (minDuration !== null) {
    return `${minDuration}+ min`;
  } else if (maxDuration !== null) {
    return `0-${maxDuration} min`;
  }
  return '';
}

function formatDateLabel(dateFrom: Date | null, dateTo: Date | null): string {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (dateFrom && dateTo) {
    return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
  } else if (dateFrom) {
    return `From ${formatDate(dateFrom)}`;
  } else if (dateTo) {
    return `Until ${formatDate(dateTo)}`;
  }
  return '';
}

function FilterChips({
  filters,
  onClearDuration,
  onClearDateRange,
}: FilterChipsProps) {
  const hasDurationFilter = filters.minDuration !== null || filters.maxDuration !== null;
  const hasDateFilter = filters.dateFrom !== null || filters.dateTo !== null;

  if (!hasDurationFilter && !hasDateFilter) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {hasDurationFilter && (
        <Chip
          icon={<AccessTimeIcon />}
          label={formatDurationLabel(filters.minDuration, filters.maxDuration)}
          size="small"
          onDelete={onClearDuration}
          color="primary"
          variant="outlined"
        />
      )}
      {hasDateFilter && (
        <Chip
          icon={<CalendarTodayIcon />}
          label={formatDateLabel(filters.dateFrom, filters.dateTo)}
          size="small"
          onDelete={onClearDateRange}
          color="primary"
          variant="outlined"
        />
      )}
    </Box>
  );
}

export default FilterChips;
