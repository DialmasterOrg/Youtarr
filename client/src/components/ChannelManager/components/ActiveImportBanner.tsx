import React from 'react';
import { Alert, Box, LinearProgress, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import MuiLink from '@mui/material/Link';
import { ImportJobSummary } from '../../../types/subscriptionImport';

interface ActiveImportBannerProps {
  activeImport: ImportJobSummary | null;
}

const ActiveImportBanner: React.FC<ActiveImportBannerProps> = ({ activeImport }) => {
  if (!activeImport) {
    return null;
  }

  // Backend sends statuses like 'In Progress', 'Complete', 'Complete with Warnings', 'Cancelled', 'Failed'
  const isInProgress = activeImport.status === 'In Progress';
  const progressPercent = activeImport.total > 0
    ? (activeImport.done / activeImport.total) * 100
    : 0;

  return (
    <Alert
      severity={isInProgress ? 'info' : 'success'}
      sx={{ mb: 2 }}
    >
      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2">
            {isInProgress
              ? `Importing channels: ${activeImport.done} of ${activeImport.total}...`
              : `Import complete! ${activeImport.done} channels imported.`}
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
        {isInProgress && (
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
