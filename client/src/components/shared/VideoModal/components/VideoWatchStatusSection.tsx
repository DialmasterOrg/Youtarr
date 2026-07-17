import React from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '../../../ui';
import { formatDate } from '../../../../utils/formatters';
import { MEDIA_SERVER_LABELS } from '../../../../utils/mediaServerLabels';
import { ServerWatchStatus } from '../hooks/useWatchStatus';

function describeStatus(status: ServerWatchStatus): string {
  if (status.played) {
    const when = status.lastWatchedAt ? formatDate(status.lastWatchedAt) : null;
    return when ? `Watched ${when}` : 'Watched';
  }
  if (status.percentWatched && status.percentWatched > 0) {
    return `In progress (${Math.round(status.percentWatched)}%)`;
  }
  return 'Unwatched';
}

interface VideoWatchStatusSectionProps {
  statuses: ServerWatchStatus[];
}

function VideoWatchStatusSection({ statuses }: VideoWatchStatusSectionProps) {
  if (statuses.length === 0) return null;

  return (
    <Accordion defaultExpanded className="w-full">
      <AccordionSummary>Watch Status</AccordionSummary>
      <AccordionDetails>
        <Box>
          {statuses.map((status) => (
            <Box
              key={status.server}
              className="flex justify-between items-start gap-3 py-1"
            >
              <Typography variant="body2" color="text.secondary">
                {MEDIA_SERVER_LABELS[status.server] || status.server}
              </Typography>
              <Typography variant="body2" color="text.primary" className="font-medium text-right">
                {describeStatus(status)}
              </Typography>
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

export default VideoWatchStatusSection;
