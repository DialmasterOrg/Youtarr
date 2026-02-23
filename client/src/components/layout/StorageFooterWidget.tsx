import React from 'react';
import { Box, LinearProgress, Tooltip, Typography } from '../ui';
import { Storage as HardDriveIcon } from '../../lib/icons';
import { useStorageStatus } from '../../hooks/useStorageStatus';

interface StorageFooterWidgetProps {
  token: string | null;
  collapsed: boolean;
  compact?: boolean;
  inline?: boolean;
  justify?: 'flex-start' | 'flex-end' | 'center';
}

export function StorageFooterWidget({ token, collapsed, compact = false, inline = false, justify = 'flex-start' }: StorageFooterWidgetProps) {
  const { data: storageData, loading, error } = useStorageStatus(token, {
    poll: true,
    pollInterval: 120000,
  });

  if (!token || error) return null;

  const percentFree = storageData?.percentFree ?? 0;
  const percentUsed = Math.max(0, Math.min(100, 100 - percentFree));
  const availableGB = storageData?.availableGB ?? 0;
  const totalGB = storageData?.totalGB ?? 0;
  const usedGB = Math.max(0, Number(totalGB) - Number(availableGB));

  // Show used-space percentage as the bar fill.
  const progressValue = Math.max(0, Math.min(100, percentUsed));
  const percentFreeLabel = Number.isFinite(percentFree) ? percentFree.toFixed(1) : '0.0';
  const inlineLabel = `${usedGB.toFixed(1)}/${Number(totalGB).toFixed(1)} GB ${progressValue.toFixed(0)}%`;

  const showDetails = !collapsed && !compact;

  const content = (
    <Box style={{ paddingLeft: compact ? 10 : collapsed ? 8 : 16, paddingRight: compact ? 10 : collapsed ? 8 : 16, paddingTop: compact ? 6 : 12, paddingBottom: compact ? 6 : 12 }}>
      <Box
        className="flex items-center"
        style={{ gap: compact ? 4 : 8, marginBottom: inline ? 0 : compact ? 4 : 8, justifyContent: inline ? justify : (collapsed || compact ? 'center' : 'flex-start') }}
      >
        <HardDriveIcon size={16} />
        {inline && (
          <Typography variant="caption" style={{ fontWeight: 600 }}>
            {loading ? 'Loading…' : inlineLabel}
          </Typography>
        )}
        {showDetails && !inline && (
          <Typography variant="body2" style={{ fontWeight: 600 }}>
            Storage
          </Typography>
        )}
      </Box>

      {!inline && (
        <LinearProgress
          variant={loading ? 'indeterminate' : 'determinate'}
          value={loading ? undefined : progressValue}
          className="rounded-[var(--radius-ui)]"
          style={{ height: compact ? 4 : collapsed ? 6 : 8 }}
        />
      )}

      {showDetails && !inline && (
        <Typography variant="caption" color="text.secondary" className="block mt-1.5">
          {loading ? 'Loading…' : `${availableGB} GB free of ${totalGB} GB (${percentFreeLabel}% free)`}
        </Typography>
      )}
    </Box>
  );

  const tooltipTitle = loading
    ? 'Loading storage…'
    : `${availableGB} GB free of ${totalGB} GB (${percentFreeLabel}% free)`;

  return (
    <Tooltip title={tooltipTitle} placement="right" arrow disableHoverListener={!collapsed}>
      <Box>{content}</Box>
    </Tooltip>
  );
}
