import React from 'react';

export const SHARED_CHIP_RADIUS = 'var(--ui-chip-radius, var(--video-chip-radius, var(--radius-ui)))';

export const SHARED_CHANNEL_META_CHIP_STYLE: React.CSSProperties = {
  fontSize: 'var(--ui-chip-small-font-size, 0.75rem)',
  height: 'var(--ui-chip-small-height, 24px)',
  borderRadius: SHARED_CHIP_RADIUS,
  boxSizing: 'border-box',
};

export const SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--channel-meta-chip-background)',
  color: 'var(--channel-meta-chip-foreground)',
  border: 'var(--channel-meta-chip-border)',
  boxShadow: 'var(--channel-meta-chip-shadow)',
};

export const SHARED_STATUS_CHIP_STYLE: React.CSSProperties = {
  borderRadius: SHARED_CHIP_RADIUS,
  border: 'var(--status-chip-border, var(--channel-meta-chip-border))',
  boxShadow: 'var(--chip-shadow)',
  transition: 'box-shadow 200ms var(--transition-bouncy)',
  boxSizing: 'border-box',
};

export const SHARED_STATUS_CHIP_SMALL_STYLE: React.CSSProperties = {
  ...SHARED_STATUS_CHIP_STYLE,
  height: 'var(--ui-chip-small-height, 24px)',
  fontSize: 'var(--ui-chip-small-font-size, 0.75rem)',
};

export const SHARED_THEMED_CHIP_STYLE: React.CSSProperties = {
  ...SHARED_STATUS_CHIP_STYLE,
  border: 'var(--rating-chip-border)',
  boxShadow: 'var(--rating-chip-shadow)',
};

export const SHARED_THEMED_CHIP_SMALL_STYLE: React.CSSProperties = {
  ...SHARED_THEMED_CHIP_STYLE,
  height: 'var(--ui-chip-small-height, 24px)',
  fontSize: 'var(--ui-chip-small-font-size, 0.75rem)',
};

export const SHARED_RATING_CHIP_STYLE: React.CSSProperties = {
  ...SHARED_THEMED_CHIP_STYLE,
};

export const SHARED_RATING_CHIP_SMALL_STYLE: React.CSSProperties = {
  ...SHARED_THEMED_CHIP_SMALL_STYLE,
};
