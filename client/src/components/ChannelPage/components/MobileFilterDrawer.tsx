import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DurationFilterInput from './DurationFilterInput';
import DateRangeFilterInput from './DateRangeFilterInput';
import { VideoFilters } from '../hooks/useChannelVideoFilters';

interface MobileFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: VideoFilters;
  inputMinDuration: number | null;
  inputMaxDuration: number | null;
  onMinDurationChange: (value: number | null) => void;
  onMaxDurationChange: (value: number | null) => void;
  onDateFromChange: (value: Date | null) => void;
  onDateToChange: (value: Date | null) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  hideDateFilter?: boolean;
}

function MobileFilterDrawer({
  open,
  onClose,
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
}: MobileFilterDrawerProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Filters</Typography>
          <IconButton onClick={onClose} size="small" data-testid="drawer-close-button">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Duration Filter */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Duration
          </Typography>
          <DurationFilterInput
            minDuration={inputMinDuration}
            maxDuration={inputMaxDuration}
            onMinChange={onMinDurationChange}
            onMaxChange={onMaxDurationChange}
            compact
          />
        </Box>

        {/* Date Range Filter */}
        {!hideDateFilter ? (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Date Range
            </Typography>
            <DateRangeFilterInput
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onFromChange={onDateFromChange}
              onToChange={onDateToChange}
              compact
            />
          </Box>
        ) : (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Shorts do not have date information
            </Typography>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={onClearAll}
            disabled={!hasActiveFilters}
            sx={{ flex: 1 }}
          >
            Clear All
          </Button>
          <Button
            variant="contained"
            onClick={onClose}
            sx={{ flex: 1 }}
          >
            Close
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

export default MobileFilterDrawer;
