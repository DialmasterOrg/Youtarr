import React from 'react';
import { Typography, Button, Divider } from '../../ui';
import { Close as CloseIcon } from '../../../lib/icons';
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
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1299,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      />
      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          backgroundColor: 'var(--card)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Typography variant="h6">Filters</Typography>
            <button
              onClick={onClose}
              data-testid="drawer-close-button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--foreground)', padding: 4 }}
            >
              <CloseIcon size={20} />
            </button>
          </div>

          <Divider style={{ marginBottom: 16 }} />

          {/* Duration Filter */}
          <div style={{ marginBottom: 24 }}>
            <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
              Duration
            </Typography>
            <DurationFilterInput
              minDuration={inputMinDuration}
              maxDuration={inputMaxDuration}
              onMinChange={onMinDurationChange}
              onMaxChange={onMaxDurationChange}
              compact
            />
          </div>

          {/* Date Range Filter */}
          {!hideDateFilter ? (
            <div style={{ marginBottom: 24 }}>
              <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
                Date Range
              </Typography>
              <DateRangeFilterInput
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                onFromChange={onDateFromChange}
                onToChange={onDateToChange}
                compact
              />
            </div>
          ) : (
            <div style={{ marginBottom: 24 }}>
              <Typography variant="body2" color="text.secondary" style={{ fontStyle: 'italic' }}>
                Shorts do not have date information
              </Typography>
            </div>
          )}

          <Divider style={{ marginBottom: 16 }} />

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <Button
              variant="outlined"
              onClick={onClearAll}
              disabled={!hasActiveFilters}
              style={{ flex: 1 }}
            >
              Clear All
            </Button>
            <Button
              variant="contained"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default MobileFilterDrawer;
