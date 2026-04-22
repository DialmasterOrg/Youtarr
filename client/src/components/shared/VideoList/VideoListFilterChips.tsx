import React from 'react';
import { Chip } from '../../ui';
import {
  AccessTime as DurationIcon,
  CalendarToday as CalendarIcon,
  Close as CloseIcon,
  Shield as ShieldIcon,
  CloudOff as CloudOffIcon,
  Block as BlockIcon,
  ListFilter as FilterIcon,
} from '../../../lib/icons';
import { FilterConfig } from './types';
import { RATING_OPTIONS } from '../../../utils/ratings';

export interface VideoListFilterChipsProps {
  filters: FilterConfig[];
}

function formatDuration(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min}-${max} min`;
  if (min !== null) return `${min}+ min`;
  if (max !== null) return `0-${max} min`;
  return '';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDateRange(from: Date | null, to: Date | null): string {
  if (from && to) return `Published: ${formatDate(from)} - ${formatDate(to)}`;
  if (from) return `Published: From ${formatDate(from)}`;
  if (to) return `Published: Until ${formatDate(to)}`;
  return '';
}

function formatDateString(value: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateStringRange(from: string, to: string): string {
  if (from && to) return `Published: ${formatDateString(from)} - ${formatDateString(to)}`;
  if (from) return `Published: From ${formatDateString(from)}`;
  if (to) return `Published: Until ${formatDateString(to)}`;
  return '';
}

function ratingLabel(value: string): string {
  const option = RATING_OPTIONS.find((opt) => opt.value === value);
  return option ? option.label.split(' — ')[0] : value;
}

function VideoListFilterChips({ filters }: VideoListFilterChipsProps) {
  const chips: React.ReactNode[] = [];

  for (const filter of filters) {
    if (filter.id === 'duration') {
      const active = filter.min !== null || filter.max !== null;
      if (!active) continue;
      const clear = () => {
        filter.onMinChange(null);
        filter.onMaxChange(null);
      };
      chips.push(
        <Chip
          key="duration"
          icon={<DurationIcon size={14} />}
          label={formatDuration(filter.min, filter.max)}
          size="small"
          onDelete={clear}
          onClick={clear}
          deleteIcon={<CloseIcon data-testid="CancelIcon" size={14} />}
          color="primary"
          variant="outlined"
        />
      );
      continue;
    }

    if (filter.id === 'dateRange') {
      if (filter.hidden) continue;
      const active = filter.dateFrom !== null || filter.dateTo !== null;
      if (!active) continue;
      const clear = () => {
        filter.onFromChange(null);
        filter.onToChange(null);
      };
      chips.push(
        <Chip
          key="dateRange"
          icon={<CalendarIcon size={14} />}
          label={formatDateRange(filter.dateFrom, filter.dateTo)}
          size="small"
          onDelete={clear}
          onClick={clear}
          deleteIcon={<CloseIcon data-testid="CancelIcon" size={14} />}
          color="primary"
          variant="outlined"
        />
      );
      continue;
    }

    if (filter.id === 'dateRangeString') {
      if (filter.hidden) continue;
      const active = Boolean(filter.dateFrom) || Boolean(filter.dateTo);
      if (!active) continue;
      const clear = () => {
        filter.onFromChange('');
        filter.onToChange('');
      };
      chips.push(
        <Chip
          key="dateRangeString"
          icon={<CalendarIcon size={14} />}
          label={formatDateStringRange(filter.dateFrom, filter.dateTo)}
          size="small"
          onDelete={clear}
          onClick={clear}
          deleteIcon={<CloseIcon data-testid="CancelIcon" size={14} />}
          color="primary"
          variant="outlined"
        />
      );
      continue;
    }

    if (filter.id === 'maxRating' && filter.value) {
      chips.push(
        <Chip
          key="maxRating"
          label={`Rating: ${ratingLabel(filter.value)}`}
          size="small"
          onDelete={() => filter.onChange('')}
          onClick={() => filter.onChange('')}
          deleteIcon={<CloseIcon data-testid="CancelIcon" size={14} />}
          color="primary"
          variant="outlined"
        />
      );
      continue;
    }

    if (filter.id === 'protected' && filter.value !== 'off') {
      chips.push(
        <Chip
          key="protected"
          icon={<ShieldIcon size={14} />}
          label={filter.value === 'only' ? 'Only: Protected' : 'Hide: Protected'}
          size="small"
          onDelete={() => filter.onChange('off')}
          onClick={() => filter.onChange('off')}
          deleteIcon={<CloseIcon data-testid="CancelIcon" size={14} />}
          color={filter.value === 'only' ? 'primary' : 'warning'}
          variant="outlined"
        />
      );
      continue;
    }

    if (filter.id === 'missing' && filter.value !== 'off') {
      chips.push(
        <Chip
          key="missing"
          icon={<CloudOffIcon size={14} />}
          label={filter.value === 'only' ? 'Only: Missing' : 'Hide: Missing'}
          size="small"
          onDelete={() => filter.onChange('off')}
          onClick={() => filter.onChange('off')}
          deleteIcon={<CloseIcon data-testid="CancelIcon" size={14} />}
          color={filter.value === 'only' ? 'primary' : 'warning'}
          variant="outlined"
        />
      );
      continue;
    }

    if (filter.id === 'ignored' && filter.value !== 'off') {
      chips.push(
        <Chip
          key="ignored"
          icon={<BlockIcon size={14} />}
          label={filter.value === 'only' ? 'Only: Ignored' : 'Hide: Ignored'}
          size="small"
          onDelete={() => filter.onChange('off')}
          onClick={() => filter.onChange('off')}
          deleteIcon={<CloseIcon data-testid="CancelIcon" size={14} />}
          color={filter.value === 'only' ? 'primary' : 'warning'}
          variant="outlined"
        />
      );
      continue;
    }

    if (filter.id === 'channel' && filter.value) {
      chips.push(
        <Chip
          key="channel"
          icon={<FilterIcon size={14} />}
          label={`Channel: ${filter.value}`}
          size="small"
          onDelete={() => filter.onChange('')}
          onClick={() => filter.onChange('')}
          deleteIcon={<CloseIcon data-testid="CancelIcon" size={14} />}
          color="primary"
          variant="outlined"
        />
      );
    }
  }

  if (chips.length === 0) return null;

  return (
    <div
      data-testid="video-list-filter-chips"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}
    >
      {chips}
    </div>
  );
}

export default VideoListFilterChips;

export function countActiveFilters(filters: FilterConfig[]): number {
  let count = 0;
  for (const filter of filters) {
    if (filter.id === 'duration' && (filter.min !== null || filter.max !== null)) count++;
    else if (filter.id === 'dateRange' && !filter.hidden && (filter.dateFrom !== null || filter.dateTo !== null)) count++;
    else if (filter.id === 'dateRangeString' && !filter.hidden && (filter.dateFrom || filter.dateTo)) count++;
    else if (filter.id === 'maxRating' && filter.value) count++;
    else if (filter.id === 'protected' && filter.value !== 'off') count++;
    else if (filter.id === 'missing' && filter.value !== 'off') count++;
    else if (filter.id === 'ignored' && filter.value !== 'off') count++;
    else if (filter.id === 'channel' && filter.value) count++;
  }
  return count;
}

export function hasActiveFilters(filters: FilterConfig[]): boolean {
  return countActiveFilters(filters) > 0;
}

export function clearAllFilters(filters: FilterConfig[]): void {
  for (const filter of filters) {
    if (filter.id === 'duration') {
      filter.onMinChange(null);
      filter.onMaxChange(null);
    } else if (filter.id === 'dateRange') {
      filter.onFromChange(null);
      filter.onToChange(null);
    } else if (filter.id === 'dateRangeString') {
      filter.onFromChange('');
      filter.onToChange('');
    } else if (filter.id === 'maxRating') {
      filter.onChange('');
    } else if (filter.id === 'protected') {
      filter.onChange('off');
    } else if (filter.id === 'missing') {
      filter.onChange('off');
    } else if (filter.id === 'ignored') {
      filter.onChange('off');
    } else if (filter.id === 'channel') {
      filter.onChange('');
    }
  }
}
