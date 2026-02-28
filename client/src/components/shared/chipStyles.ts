import React from 'react';

export const SHARED_CHIP_RADIUS = 'var(--ui-chip-radius, var(--video-chip-radius, var(--radius-ui)))';

export const SHARED_CHANNEL_META_CHIP_STYLE: React.CSSProperties = {
  fontSize: '0.7rem',
  height: 24,
  borderRadius: SHARED_CHIP_RADIUS,
};

export const SHARED_STATUS_CHIP_STYLE: React.CSSProperties = {
  borderRadius: SHARED_CHIP_RADIUS,
  boxShadow: 'var(--chip-shadow)',
  transition: 'box-shadow 200ms var(--transition-bouncy)',
};

export const SHARED_STATUS_CHIP_SMALL_STYLE: React.CSSProperties = {
  ...SHARED_STATUS_CHIP_STYLE,
  height: 24,
  fontSize: '0.75rem',
};
