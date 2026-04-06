import React, { useEffect, useRef } from 'react';
import { Alert, Box, LinearProgress, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import MuiLink from '@mui/material/Link';
import { ImportJobSummary } from '../../../types/subscriptionImport';

interface ActiveImportBannerProps {
  activeImport: ImportJobSummary | null;
}

const ActiveImportBanner: React.FC<ActiveImportBannerProps> = ({ activeImport }) => {
  const prevStatusRef = useRef<string | null>(null);
  const justCompleted = useRef(false);

  useEffect(() => {
    if (
      prevStatusRef.current &&
      prevStatusRef.current !== 'complete' &&
      activeImport?.status === 'complete'
    ) {
      justCompleted.current = true;
    } else if (!activeImport) {
      justCompleted.current = false;
    }
    prevStatusRef.current = activeImport?.status ?? null;
  }, [activeImport?.status, activeImport]);

  if (!activeImport) {
    return null;
  }

  const isComplete = activeImport.status === 'complete';
  const progressPercent = activeImport.total > 0
    ? (activeImport.done / activeImport.total) * 100
    : 0;

  return (
    <Alert
      severity={isComplete ? 'success' : 'info'}
      sx={{ mb: 2 }}
    >
      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2">
            {isComplete
              ? `Import complete! ${activeImport.done} channels imported.`
              : `Importing channels: ${activeImport.done} of ${activeImport.total}...`}
          </Typography>
          <MuiLink
            component={RouterLink}
            to="/channels/import"
            variant="body2"
            sx={{ ml: 2, whiteSpace: 'nowrap' }}
          >
            View details
          </MuiLink>
        </Box>
        {!isComplete && (
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{ mt: 0.5 }}
          />
        )}
      </Box>
    </Alert>
  );
};

export default ActiveImportBanner;
