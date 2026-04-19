import React, { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  Typography,
} from '../../ui';
import {
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
} from '../../../lib/icons';
import { ImportJobDetail, ImportChannelResult } from '../../../types/subscriptionImport';

interface ImportProgressProps {
  jobDetail: ImportJobDetail;
  onCancel: () => void;
}

const TERMINAL_STATUSES = ['Complete', 'Complete with Warnings', 'Cancelled', 'Failed'];

function getProgressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function getStatusText(jobDetail: ImportJobDetail): string {
  if (TERMINAL_STATUSES.includes(jobDetail.status)) {
    return jobDetail.status;
  }
  return `Importing ${jobDetail.done} of ${jobDetail.total} channels...`;
}

const stateChipMap: Record<ImportChannelResult['state'], { color: 'success' | 'error' | 'default'; label: string }> = {
  success: { color: 'success', label: 'Imported' },
  error: { color: 'error', label: 'Failed' },
  skipped: { color: 'default', label: 'Skipped' },
  pending: { color: 'default', label: 'Pending' },
};

const ChannelResultItem: React.FC<{ result: ImportChannelResult }> = ({ result }) => {
  const [expanded, setExpanded] = useState(false);
  const hasExpandableContent = result.state === 'error' && result.details;

  const secondaryText = result.state === 'error'
    ? result.error || 'Unknown error'
    : result.state === 'skipped'
      ? result.reason || 'Already subscribed'
      : undefined;

  return (
    <div className="rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-card/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Typography variant="body2" className="font-semibold">{result.title || result.channelId}</Typography>
            <Chip size="small" color={stateChipMap[result.state].color} label={stateChipMap[result.state].label} />
          </div>
          {secondaryText && (
            <Typography variant="caption" color={result.state === 'error' ? 'error' : 'secondary'}>
              {secondaryText}
            </Typography>
          )}
        </div>
        {hasExpandableContent && (
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'collapse details' : 'expand details'}
          >
            {expanded ? <ExpandLess size={16} /> : <ExpandMore size={16} />}
          </IconButton>
        )}
      </div>
      {hasExpandableContent && (
        <pre
          hidden={!expanded}
          className="mt-3 whitespace-pre-wrap break-words rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-muted/40 p-3 text-xs text-muted-foreground"
        >
          {result.details}
        </pre>
      )}
    </div>
  );
};

const ImportProgress: React.FC<ImportProgressProps> = ({ jobDetail, onCancel }) => {
  const percent = getProgressPercent(jobDetail.done, jobDetail.total);
  const isTerminal = TERMINAL_STATUSES.includes(jobDetail.status);

  return (
    <Card variant="outlined">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Typography variant="h6">Import Progress</Typography>
            <Typography variant="body2" color="secondary">{getStatusText(jobDetail)}</Typography>
          </div>
          <Chip
            size="small"
            color={isTerminal ? (jobDetail.status === 'Failed' ? 'error' : 'success') : 'info'}
            label={isTerminal ? 'Finished' : 'Running'}
          />
        </div>

        <LinearProgress
          variant={jobDetail.total > 0 ? 'determinate' : 'indeterminate'}
          value={percent}
          height={8}
        />

        {jobDetail.total > 0 && (
          <Typography variant="caption" color="secondary">
            {percent}% complete
          </Typography>
        )}

        <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
          {jobDetail.results.map((result) => (
            <ChannelResultItem key={result.channelId} result={result} />
          ))}
        </div>

        {!isTerminal && (
          <Button variant="outlined-destructive" onClick={onCancel}>Cancel Import</Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ImportProgress;
