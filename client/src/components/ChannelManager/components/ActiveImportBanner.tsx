import React from 'react';
import { Alert, AlertColor, Box, LinearProgress, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import MuiLink from '@mui/material/Link';
import { ImportJobSummary } from '../../../types/subscriptionImport';

interface ActiveImportBannerProps {
  activeImport: ImportJobSummary | null;
}

interface StatusDisplay {
  severity: AlertColor;
  text: string;
}

function getStatusDisplay(status: string, done: number, total: number): StatusDisplay {
  switch (status) {
    case 'In Progress':
      return { severity: 'info', text: `Importing channels: ${done} of ${total}...` };
    case 'Cancelled':
      return { severity: 'warning', text: `Import cancelled (${done} of ${total} processed).` };
    case 'Failed':
      return { severity: 'error', text: `Import failed (${done} of ${total} processed).` };
    case 'Complete with Warnings':
      return { severity: 'warning', text: `Import complete with warnings. ${done} channels imported.` };
    default:
      return { severity: 'success', text: `Import complete! ${done} channels imported.` };
  }
}

const ActiveImportBanner: React.FC<ActiveImportBannerProps> = ({ activeImport }) => {
  if (!activeImport) {
    return null;
  }

  const { severity, text } = getStatusDisplay(activeImport.status, activeImport.done, activeImport.total);
  const isInProgress = activeImport.status === 'In Progress';
  const progressPercent = activeImport.total > 0
    ? (activeImport.done / activeImport.total) * 100
    : 0;

  return (
    <Alert
      severity={severity}
      sx={{ mb: 2 }}
    >
      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2">
            {text}
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
