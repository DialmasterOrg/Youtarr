import React from 'react';
import { Box, Typography } from '../../ui';
import { Warning as WarningIcon } from '../../../lib/icons';

interface TerminatedNoticeProps {
  terminatedAt: string | null | undefined;
  isMobile?: boolean;
}

const formatDetectionDate = (terminatedAt: string): string => {
  const parsed = new Date(terminatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return 'unknown date';
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const TerminatedNotice: React.FC<TerminatedNoticeProps> = ({ terminatedAt, isMobile = false }) => {
  if (!terminatedAt) {
    return null;
  }

  const message = `YouTube terminated this channel; detected on ${formatDetectionDate(terminatedAt)}. Scheduled downloads are disabled.`;

  return (
    <Box
      role="status"
      data-testid="terminated-notice"
      className="flex items-center gap-2"
      style={{ color: 'var(--destructive)' }}
    >
      <WarningIcon size={isMobile ? 14 : 16} data-testid="WarningIcon" />
      <Typography
        variant={isMobile ? 'body2' : 'body1'}
        style={{ color: 'var(--destructive)' }}
      >
        {message}
      </Typography>
    </Box>
  );
};

export default TerminatedNotice;
