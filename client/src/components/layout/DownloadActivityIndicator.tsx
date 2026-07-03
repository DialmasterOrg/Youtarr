import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Tooltip } from '../ui';
import { ArrowDownward, Loader2 } from '../../lib/icons';
import { useActiveDownloads } from '../../hooks/useActiveDownloads';

const INDICATOR_SIZE = 22;
const ARROW_SIZE = 11;

interface DownloadActivityIndicatorProps {
  token: string | null;
}

/**
 * Stays animated even when the user prefers reduced motion, same as the
 * app's .loading-spinner: the motion is the status signal.
 */
export function DownloadActivityIndicator({ token }: DownloadActivityIndicatorProps) {
  const { active } = useActiveDownloads(token);
  const navigate = useNavigate();

  if (!active) {
    return null;
  }

  return (
    <Tooltip title="Video downloads are in progress" placement="bottom" arrow>
      <IconButton
        aria-label="Video downloads are in progress"
        color="primary"
        className="mr-1"
        onClick={() => navigate('/downloads/activity')}
      >
        <span
          className="relative inline-flex items-center justify-center"
          style={{ width: INDICATOR_SIZE, height: INDICATOR_SIZE }}
        >
          <Loader2
            size={INDICATOR_SIZE}
            className="absolute inset-0 animate-spin"
            data-testid="download-activity-spinner"
            aria-hidden="true"
          />
          <ArrowDownward
            size={ARROW_SIZE}
            strokeWidth={3}
            className="animate-download-arrow-drop"
            data-testid="download-activity-arrow"
            aria-hidden="true"
          />
        </span>
      </IconButton>
    </Tooltip>
  );
}
