import React from 'react';
import { Box, LinearProgress, Tooltip, Typography } from '../ui';
import { Storage as StorageIcon } from '../../lib/icons';
import { useStorageStatus } from '../../hooks/useStorageStatus';

interface StorageHeaderWidgetProps {
  token: string | null;
}

export function StorageHeaderWidget({ token }: StorageHeaderWidgetProps) {
  const { data: storageData, loading, error } = useStorageStatus(token, {
    poll: true,
    pollInterval: 120000,
  });

  if (!token || error) return null;

  const percentFree = storageData?.percentFree ?? 0;
  const percentUsed = Math.max(0, Math.min(100, 100 - percentFree));
  const availableGB = Number(storageData?.availableGB ?? 0);
  const totalGB = Number(storageData?.totalGB ?? 0);
  const usedGB = Math.max(0, totalGB - availableGB);

  // Show used-space percentage as the bar fill.
  const progressValue = Math.max(0, Math.min(100, percentUsed));
  const percentFreeLabel = Number.isFinite(percentFree) ? percentFree.toFixed(1) : '0.0';
  const safeUsed = Number.isFinite(usedGB) ? usedGB.toFixed(1) : '0.0';
  const safeTotal = Number.isFinite(totalGB) ? totalGB.toFixed(1) : '0.0';

  const tooltipTitle = (
    <Box className="p-2 min-w-[180px] text-center">
      <LinearProgress
        variant="determinate"
        value={progressValue}
        className="h-2 rounded-[var(--radius-ui)] mb-3"
      />
      <Typography variant="body2" style={{ fontWeight: 600 }}>
        {safeUsed} GB / {safeTotal} GB
      </Typography>
      <Typography variant="caption" className="mt-1 opacity-70">
        {percentFreeLabel}% free
      </Typography>
    </Box>
  );

  return (
    <Tooltip 
      title={tooltipTitle} 
      placement="bottom" 
      arrow
    >
      <Box 
        className="flex flex-col items-center justify-center cursor-help mx-0.5 hover:bg-black/5 transition-colors"
        style={{ width: 44, height: 44, borderRadius: 'var(--radius-ui)' }}
      >
        <StorageIcon size={18} className="text-muted-foreground" />
        <Box className="w-8 mt-0.5">
          <LinearProgress
            variant={loading ? 'indeterminate' : 'determinate'}
            value={loading ? undefined : progressValue}
            className="h-1.5 rounded-[var(--radius-ui)]"
          />
        </Box>
      </Box>
    </Tooltip>
  );
}
