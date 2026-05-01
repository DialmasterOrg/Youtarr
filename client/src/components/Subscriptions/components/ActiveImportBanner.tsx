import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, LinearProgress, Typography } from '../../ui';
import { ImportJobSummary } from '../../../types/subscriptionImport';

interface ActiveImportBannerProps {
  activeImport: ImportJobSummary | null;
}

interface StatusDisplay {
  severity: 'info' | 'warning' | 'error' | 'success';
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
    <Alert severity={severity} className="mb-2">
      <div className="w-full flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <Typography variant="body2">{text}</Typography>
          <Button asChild variant="link" size="small">
            <RouterLink to="/subscriptions/imports">View details</RouterLink>
          </Button>
        </div>
        {isInProgress && (
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            height={6}
          />
        )}
      </div>
    </Alert>
  );
};

export default ActiveImportBanner;
