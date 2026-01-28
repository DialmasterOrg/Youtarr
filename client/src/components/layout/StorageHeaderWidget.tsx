import React from 'react';
import { Box, LinearProgress, Tooltip, Typography, useTheme } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import { useStorageStatus } from '../../hooks/useStorageStatus';

interface StorageHeaderWidgetProps {
  token: string | null;
}

export function StorageHeaderWidget({ token }: StorageHeaderWidgetProps) {
  const { data: storageData, loading, error } = useStorageStatus(token, {
    poll: true,
    pollInterval: 120000,
  });
  const theme = useTheme();

  if (!token || error) return null;

  const percentFree = storageData?.percentFree ?? 0;
  const percentUsed = storageData?.percentUsed ?? Math.max(0, Math.min(100, 100 - percentFree));
  const availableGB = storageData?.availableGB ?? 0;
  const totalGB = storageData?.totalGB ?? 0;

  // Show used-space percentage as the bar fill.
  const progressValue = Math.max(0, Math.min(100, percentUsed));
  const percentFreeLabel = Number.isFinite(percentFree) ? percentFree.toFixed(1) : '0.0';

  const tooltipTitle = (
    <Box sx={{ p: 1, minWidth: 180, textAlign: 'center' }}>
      <LinearProgress
        variant="determinate"
        value={progressValue}
        sx={{ 
          height: 8, 
          borderRadius: 'var(--radius-ui)',
          mb: 1.5,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 'var(--radius-ui)',
            backgroundColor: theme.palette.primary.main,
          }
        }}
      />
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {availableGB} GB / {totalGB} GB
      </Typography>
      <Typography variant="caption" sx={{ mt: 0.5, color: 'rgba(255, 255, 255, 0.7)' }}>
        {percentFreeLabel}% free
      </Typography>
    </Box>
  );

  return (
    <Tooltip 
      title={tooltipTitle} 
      placement="bottom" 
      arrow
      PopperProps={{
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, 10],
            },
          },
        ],
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          cursor: 'help',
          mx: 0.5,
          width: 44,
          height: 44,
          borderRadius: 'var(--radius-ui)',
          transition: 'background-color 0.2s ease',
          '&:hover': {
            bgcolor: 'rgba(0, 0, 0, 0.04)',
          }
        }}
      >
        <StorageIcon sx={{ fontSize: '1.2rem', color: 'text.secondary' }} />
        <Box sx={{ width: '32px', mt: 0.5 }}>
          <LinearProgress
            variant={loading ? 'indeterminate' : 'determinate'}
            value={loading ? undefined : progressValue}
            sx={{ 
              height: 6, 
              borderRadius: 'var(--radius-ui)',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.palette.primary.main,
              }
            }}
          />
        </Box>
      </Box>
    </Tooltip>
  );
}
