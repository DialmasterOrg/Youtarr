import React from 'react';
import { Typography, Button, Chip, Divider } from '../../ui';
import { Close as CloseIcon, Shield as ShieldIcon } from '../../../lib/icons';
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
  protectedFilter?: boolean;
  onProtectedFilterChange?: (value: boolean) => void;
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
  protectedFilter = false,
  onProtectedFilterChange,
}: MobileFilterDrawerProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) {
        return;
      }

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1299,
          backgroundColor: 'var(--overlay-backdrop-background)',
        }}
      />
      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-filter-drawer-title"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          backgroundColor: 'var(--card)',
          borderTopLeftRadius: 'var(--radius-ui)',
          borderTopRightRadius: 'var(--radius-ui)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: 16 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Typography id="mobile-filter-drawer-title" variant="h6">Filters</Typography>
            <button
              ref={closeButtonRef}
              type="button"
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

          {/* Protected Filter */}
          {onProtectedFilterChange && (
            <div style={{ marginBottom: 24 }}>
              <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
                Status
              </Typography>
              <Chip
                icon={<ShieldIcon size={16} />}
                label="Protected"
                variant={protectedFilter ? 'filled' : 'outlined'}
                color={protectedFilter ? 'primary' : 'default'}
                size="small"
                onClick={() => onProtectedFilterChange(!protectedFilter)}
              />
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
