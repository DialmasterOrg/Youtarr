import React from 'react';
import { Box, LinearProgress, Tooltip, Typography } from '@mui/material';
import HardDriveIcon from '@mui/icons-material/Storage';
import { useStorageStatus } from '../../hooks/useStorageStatus';

interface StorageFooterWidgetProps {
  token: string | null;
  collapsed: boolean;
}

export function StorageFooterWidget({ token, collapsed }: StorageFooterWidgetProps) {
  const { data: storageData, loading, error } = useStorageStatus(token, {
    poll: true,
    pollInterval: 120000,
  });

  if (!token || error) return null;

  const percentFree = storageData?.percentFree ?? 0;
  const percentUsed = storageData?.percentUsed ?? Math.max(0, Math.min(100, 100 - percentFree));
  const availableGB = storageData?.availableGB ?? 0;
  const totalGB = storageData?.totalGB ?? 0;

  // Show used-space percentage as the bar fill.
  const progressValue = Math.max(0, Math.min(100, percentUsed));
  const percentFreeLabel = Number.isFinite(percentFree) ? percentFree.toFixed(1) : '0.0';

  const content = (
    <Box sx={{ px: collapsed ? 1 : 2, py: 1.5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <HardDriveIcon fontSize="small" />
        {!collapsed && (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Storage
          </Typography>
        )}
      </Box>

      <LinearProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={loading ? undefined : progressValue}
        sx={{
          height: collapsed ? 6 : 8,
          borderRadius: 'var(--radius-ui)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 'var(--radius-ui)',
          }
        }}
      />

      {!collapsed && (
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
