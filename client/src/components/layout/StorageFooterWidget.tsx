import React from 'react';
import { Box, LinearProgress, Tooltip, Typography } from '@mui/material';
import HardDriveIcon from '@mui/icons-material/Storage';
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
  const percentUsed = storageData?.percentUsed ?? Math.max(0, Math.min(100, 100 - percentFree));
  const availableGB = storageData?.availableGB ?? 0;
  const totalGB = storageData?.totalGB ?? 0;
  const usedGB = Math.max(0, Number(totalGB) - Number(availableGB));

  // Show used-space percentage as the bar fill.
  const progressValue = Math.max(0, Math.min(100, percentUsed));
  const percentFreeLabel = Number.isFinite(percentFree) ? percentFree.toFixed(1) : '0.0';
  const inlineLabel = `${usedGB.toFixed(1)}/${Number(totalGB).toFixed(1)} GB ${progressValue.toFixed(0)}%`;

  const showDetails = !collapsed && !compact;

  const content = (
    <Box sx={{ px: compact ? 1.25 : collapsed ? 1 : 2, py: compact ? 0.75 : 1.5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 0.5 : 1,
          mb: inline ? 0 : compact ? 0.5 : 1,
          justifyContent: inline ? justify : (collapsed || compact ? 'center' : 'flex-start'),
        }}
      >
        <HardDriveIcon fontSize="small" />
        {inline && (
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {loading ? 'Loading…' : inlineLabel}
          </Typography>
        )}
        {showDetails && !inline && (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Storage
          </Typography>
        )}
      </Box>

      {!inline && (
        <LinearProgress
          variant={loading ? 'indeterminate' : 'determinate'}
          value={loading ? undefined : progressValue}
          sx={{
            height: compact ? 4 : collapsed ? 6 : 8,
            borderRadius: 'var(--radius-ui)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 'var(--radius-ui)',
            }
          }}
        />
      )}

      {showDetails && !inline && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
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
