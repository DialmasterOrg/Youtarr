import React, { useState, useMemo } from 'react';
import {
  Alert, Box, Button, Collapse, IconButton, List, ListItem,
  ListItemIcon, ListItemText, Typography,
} from '@mui/material';
import {
  CheckCircle, Error as ErrorIcon, ExpandLess, ExpandMore,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { ImportJobDetail, ImportChannelResult } from '../../../types/subscriptionImport';

interface ImportSummaryProps {
  jobDetail: ImportJobDetail;
}

const ErrorItem: React.FC<{ result: ImportChannelResult }> = ({ result }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(result.details);

  return (
    <>
      <ListItem
        secondaryAction={
          hasDetails ? (
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
          <ErrorIcon sx={{ color: 'error.main' }} />
        </ListItemIcon>
        <ListItemText
          primary={result.title || result.channelId}
          secondary={result.error || 'Unknown error'}
          primaryTypographyProps={{ variant: 'body2' }}
          secondaryTypographyProps={{ variant: 'caption', sx: { color: 'error.main' } }}
        />
      </ListItem>
      {hasDetails && (
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
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CheckCircle sx={{ color: 'success.main' }} />
        <Typography variant="h6">Import {isCancelled ? 'Cancelled' : 'Complete'}</Typography>
      </Box>

      <Typography variant="body1" sx={{ mb: 2 }}>
        {successCount} imported, {errorCount} errors, {skippedCount} skipped
      </Typography>

      {isCancelled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Import was cancelled.
        </Alert>
      )}

      {errorCount > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'error.main' }}>
            Failed Channels
          </Typography>
          <List disablePadding>
            {errorResults.map((result) => (
              <ErrorItem key={result.channelId} result={result} />
            ))}
          </List>
        </Box>
      )}

      <Button
        component={RouterLink}
        to="/channels"
        variant="contained"
      >
        Back to channels
      </Button>
    </Box>
  );
};

export default ImportSummary;
