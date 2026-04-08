import React, { useState } from 'react';
import {
  Box, Button, Collapse, IconButton, LinearProgress, List, ListItem,
  ListItemIcon, ListItemText, Typography,
} from '@mui/material';
import {
  CheckCircle, Error as ErrorIcon, ExpandMore, ExpandLess,
  HourglassEmpty, SkipNext,
} from '@mui/icons-material';
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

const stateIconMap: Record<ImportChannelResult['state'], React.ReactNode> = {
  success: <CheckCircle sx={{ color: 'success.main' }} />,
  error: <ErrorIcon sx={{ color: 'error.main' }} />,
  skipped: <SkipNext sx={{ color: 'text.disabled' }} />,
  pending: <HourglassEmpty sx={{ color: 'text.disabled' }} />,
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
    <>
      <ListItem
        secondaryAction={
          hasExpandableContent ? (
            <IconButton
              edge="end"
              size="small"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'collapse details' : 'expand details'}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          ) : undefined
        }
        sx={{ py: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          {stateIconMap[result.state]}
        </ListItemIcon>
        <ListItemText
          primary={result.title || result.channelId}
          secondary={secondaryText}
          primaryTypographyProps={{ variant: 'body2' }}
          secondaryTypographyProps={{
            variant: 'caption',
            sx: { color: result.state === 'error' ? 'error.main' : 'text.secondary' },
          }}
        />
      </ListItem>
      {hasExpandableContent && (
        <Collapse in={expanded} timeout="auto">
          <Box sx={{ pl: 7, pr: 2, pb: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
              {result.details}
            </Typography>
          </Box>
        </Collapse>
      )}
    </>
  );
};

const ImportProgress: React.FC<ImportProgressProps> = ({ jobDetail, onCancel }) => {
  const percent = getProgressPercent(jobDetail.done, jobDetail.total);
  const isTerminal = TERMINAL_STATUSES.includes(jobDetail.status);

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
        {getStatusText(jobDetail)}
      </Typography>

      <LinearProgress
        variant={jobDetail.total > 0 ? 'determinate' : 'indeterminate'}
        value={percent}
        sx={{ mb: 1, height: 8, borderRadius: 1 }}
      />

      {jobDetail.total > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
          {percent}% complete
        </Typography>
      )}

      <Box sx={{ maxHeight: 400, overflow: 'auto', mb: 2 }}>
        <List disablePadding>
          {jobDetail.results.map((result) => (
            <ChannelResultItem key={result.channelId} result={result} />
          ))}
        </List>
      </Box>

      {!isTerminal && (
        <Button
          variant="outlined"
          color="error"
          onClick={onCancel}
        >
          Cancel Import
        </Button>
      )}
    </Box>
  );
};

export default ImportProgress;
