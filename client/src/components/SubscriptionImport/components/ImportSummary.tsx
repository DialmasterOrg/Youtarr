import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  Typography,
} from '../../ui';
import { CheckCircle, ChevronDown as ExpandMore, ChevronUp as ExpandLess } from '../../../lib/icons';
import { ImportJobDetail, ImportChannelResult } from '../../../types/subscriptionImport';

interface ImportSummaryProps {
  jobDetail: ImportJobDetail;
}

const ErrorItem: React.FC<{ result: ImportChannelResult }> = ({ result }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(result.details);

  return (
    <div className="rounded-[var(--radius-ui)] border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Typography variant="body2" className="font-semibold">{result.title || result.channelId}</Typography>
          <Typography variant="caption" color="error">{result.error || 'Unknown error'}</Typography>
        </div>
        {hasDetails && (
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'collapse details' : 'expand details'}
          >
            {expanded ? <ExpandLess size={16} /> : <ExpandMore size={16} />}
          </IconButton>
        )}
      </div>
      {hasDetails && (
        <Collapse in={expanded} timeout="auto">
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-card p-3 text-xs text-muted-foreground">
            {result.details}
          </pre>
        </Collapse>
      )}
    </div>
  );
};

const ImportSummary: React.FC<ImportSummaryProps> = ({ jobDetail }) => {
  const { successCount, errorCount, skippedCount, errorResults } = useMemo(() => {
    let success = 0;
    let errors = 0;
    let skipped = 0;
    const errored: ImportChannelResult[] = [];

    for (const result of jobDetail.results) {
      switch (result.state) {
        case 'success':
          success++;
          break;
        case 'error':
          errors++;
          errored.push(result);
          break;
        case 'skipped':
          skipped++;
          break;
        default:
          break;
      }
    }

    return { successCount: success, errorCount: errors, skippedCount: skipped, errorResults: errored };
  }, [jobDetail.results]);

  const isCancelled = jobDetail.status === 'Cancelled';

  return (
    <Card variant="outlined">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-success" />
            <Typography variant="h6">Import {isCancelled ? 'Cancelled' : 'Complete'}</Typography>
          </div>
          <Chip size="small" color={errorCount > 0 ? 'warning' : 'success'} label={jobDetail.status} />
        </div>

        <Typography variant="body2" color="secondary">
          {successCount} imported, {errorCount} errors, {skippedCount} skipped
        </Typography>

        {isCancelled && (
          <Alert severity="warning">
            <Typography variant="body2">Import was cancelled.</Typography>
          </Alert>
        )}

        {errorCount > 0 && (
          <div className="space-y-2">
            <Typography variant="subtitle2" color="error">Failed Channels</Typography>
            <div className="space-y-2">
              {errorResults.map((result) => (
                <ErrorItem key={result.channelId} result={result} />
              ))}
            </div>
          </div>
        )}

        <Button asChild variant="contained">
          <RouterLink to="/channels">Back to channels</RouterLink>
        </Button>
      </CardContent>
    </Card>
  );
};

export default ImportSummary;
