import React from 'react';
import { Chip } from '../ui';
import { formatDuration } from '../../utils';

interface OverlaySizeProps {
  // For the small thumbnails of list and table rows.
  compact?: boolean;
}

// Both sit inside a thumbnail box that is position: relative.

export function YoutubeRemovedBanner({ compact = false }: OverlaySizeProps) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-[2] text-center font-bold"
      style={{
        // A label only: it can cover part of the thumbnail's click target,
        // and a click it kept would fall through to the row's selection.
        pointerEvents: 'none',
        backgroundColor: 'var(--media-overlay-danger-background)',
        color: 'var(--media-overlay-foreground)',
        padding: compact ? '2px 4px' : '4px 8px',
        fontSize: compact ? '0.65rem' : '0.75rem',
      }}
    >
      Removed From YouTube
    </div>
  );
}

interface DurationBadgeProps extends OverlaySizeProps {
  duration: number | null | undefined;
}

// Nothing is shown for an unknown duration.
export function DurationBadge({ duration, compact = false }: DurationBadgeProps) {
  const label = formatDuration(duration ?? null);
  if (!label) return null;
  const inset = compact ? 4 : 8;
  return (
    <Chip
      label={label}
      size="small"
      style={{
        position: 'absolute',
        bottom: inset,
        right: inset,
        zIndex: 2,
        backgroundColor: 'var(--media-overlay-background-strong)',
        color: 'var(--media-overlay-foreground)',
        fontSize: compact ? '0.7rem' : '0.75rem',
        height: compact ? 18 : 22,
      }}
    />
  );
}
