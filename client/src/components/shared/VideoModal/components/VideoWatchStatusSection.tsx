import React from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '../../../ui';
import { formatDate } from '../../../../utils/formatters';
import { MEDIA_SERVER_LABELS } from '../../../../utils/mediaServerLabels';
import { ServerWatchStatus } from '../hooks/useWatchStatus';

// One line per server, aggregated across that server's users: watched wins
// (with the most recent date and the names of the users who watched), then
// the furthest in-progress position, then unwatched.
function describeServer(rows: ServerWatchStatus[]): string {
  const played = rows.filter((row) => row.played);
  if (played.length > 0) {
    const newest = played
      .map((row) => (row.lastWatchedAt ? new Date(row.lastWatchedAt).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    const when = newest ? formatDate(new Date(newest).toISOString()) : null;
    const names = played
      .map((row) => row.userName)
      .filter((name): name is string => !!name);
    const by = names.length > 0 ? ` by ${names.join(', ')}` : '';
    return `${when ? `Watched ${when}` : 'Watched'}${by}`;
  }
  const bestPercent = rows.reduce((max, row) => Math.max(max, row.percentWatched || 0), 0);
  if (bestPercent > 0) {
    return `In progress (${Math.round(bestPercent)}%)`;
  }
  return 'Unwatched';
}

interface VideoWatchStatusSectionProps {
  statuses: ServerWatchStatus[];
}

function VideoWatchStatusSection({ statuses }: VideoWatchStatusSectionProps) {
  if (statuses.length === 0) return null;

  const byServer = new Map<string, ServerWatchStatus[]>();
  for (const status of statuses) {
    if (!byServer.has(status.server)) byServer.set(status.server, []);
    const rows = byServer.get(status.server);
    if (rows) rows.push(status);
  }

  return (
    <Accordion defaultExpanded className="w-full">
      <AccordionSummary>Watch Status</AccordionSummary>
      <AccordionDetails>
        <Box>
          {[...byServer.entries()].map(([server, rows]) => (
            <Box
              key={server}
              className="flex justify-between items-start gap-3 py-1"
            >
              <Typography variant="body2" color="text.secondary">
                {MEDIA_SERVER_LABELS[server] || server}
              </Typography>
              <Typography variant="body2" color="text.primary" className="font-medium text-right">
                {describeServer(rows)}
              </Typography>
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

export default VideoWatchStatusSection;
