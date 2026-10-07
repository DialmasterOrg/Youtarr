import React from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Key } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '../ui';
import PageControls from '../shared/PageControls';
import {
  ExternalRequestReview,
  ExternalRequestStatus,
} from '../../types/externalRequest';
import RequestActions from './RequestActions';
import RequestTarget, { RequestStatus } from './RequestTarget';
import { ReviewAction, useExternalRequests } from './hooks/useExternalRequests';

const STATUSES: ExternalRequestStatus[] = [
  'pending',
  'approved',
  'processing',
  'completed',
  'rejected',
  'failed',
  'cancelled',
];
import { requestDateLabel as dateLabel } from './requestPolicy';
import RequestDetailsDialog from './RequestDetailsDialog';
import RequestActionDialog from './RequestActionDialog';
interface RequestsPageProps {
  token: string;
}

const RequestsPage: React.FC<RequestsPageProps> = ({ token }) => {
  const compact = useMediaQuery('(max-width: 767px)');
  const state = useExternalRequests(token);
  const {
    filters,
    requests,
    requesters,
    loading,
    error,
    totalPages,
    page,
    selected,
    action,
    detailLoading,
    reason,
    actionError,
    submitting,
    grantToRequestingKey,
  } = state;
  const chooseAction = (next: ReviewAction) => {
    if (selected) state.beginInlineAction(selected, next);
  };
  const controls = (request: ExternalRequestReview) => (
    <RequestActions
      request={request}
      submitting={submitting}
      onDetails={() => void state.openDetail(request)}
      onAction={(next) => state.beginInlineAction(request, next)}
    />
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Typography variant="h5">External Requests</Typography>
          <Typography variant="body2" color="secondary">
            Review video, channel, and deletion requests submitted by approved
            external clients.
          </Typography>
        </div>
        <Button asChild variant="outlined" size="small">
          <Link to="/settings/api-keys">
            <Key size={16} aria-hidden /> Manage API keys
          </Link>
        </Button>
      </div>
      <Card variant="outlined">
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
            <div>
              <Typography variant="caption" color="secondary">
                Status
              </Typography>
              <Select
                value={filters.status}
                onValueChange={(value) => state.setFilter('status', value)}
                fullWidth
                size="small"
                inputProps={{ 'aria-label': 'Filter by status' }}
              >
                <MenuItem value="">All statuses</MenuItem>
                {STATUSES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </div>
            <div>
              <Typography variant="caption" color="secondary">
                Requester
              </Typography>
              <Select
                value={filters.apiKeyId}
                onValueChange={(value) => state.setFilter('apiKeyId', value)}
                fullWidth
                size="small"
                inputProps={{ 'aria-label': 'Filter by requester' }}
              >
                <MenuItem value="">All requesters</MenuItem>
                {requesters.map((r) => (
                  <MenuItem key={r.id} value={String(r.id)}>
                    {r.name} ({r.keyPrefix})
                  </MenuItem>
                ))}
              </Select>
            </div>
            <div>
              <Typography variant="caption" color="secondary">
                Type
              </Typography>
              <Select
                value={filters.requestType}
                onValueChange={(value) => state.setFilter('requestType', value)}
                fullWidth
                size="small"
                inputProps={{ 'aria-label': 'Filter by request type' }}
              >
                <MenuItem value="">All types</MenuItem>
                <MenuItem value="video">Video download</MenuItem>
                <MenuItem value="channel">Channel</MenuItem>
                <MenuItem value="delete_video">Video deletion</MenuItem>
              </Select>
            </div>
            <Button
              variant="outlined"
              size="small"
              onClick={state.refresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
          {loading && (
            <div
              className="flex items-center justify-center gap-3 py-12"
              role="status"
            >
              <CircularProgress size={24} />
              <Typography variant="body2">Loading requests...</Typography>
            </div>
          )}
          {!loading && error && (
            <Alert severity="error">
              <div className="space-y-2">
                <Typography variant="body2">{error}</Typography>
                <Button size="small" variant="outlined" onClick={state.refresh}>
                  Retry
                </Button>
              </div>
            </Alert>
          )}
          {!loading && !error && requests.length === 0 && (
            <div className="py-12 text-center">
              <Typography variant="body1">
                No requests match these filters.
              </Typography>
            </div>
          )}
          {!loading && !error && requests.length > 0 && (compact ? (
            <div className="space-y-3" aria-label="External requests">
              {requests.map(request => (
                <article key={request.id} data-testid={`request-card-${request.id}`}
                  className="min-w-0 space-y-3 rounded border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <RequestStatus status={request.status} />
                    <div className="[&_button]:h-11 [&_button]:w-11">{controls(request)}</div>
                  </div>
                  <div data-testid={`request-summary-${request.id}`}>
                    <RequestTarget request={request} compact />
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="break-words">{request.requester?.name || 'Unavailable key'}</p>
                    <p>{dateLabel(request.createdAt)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell component="th">Status</TableCell>
                    <TableCell component="th">Request</TableCell>
                    <TableCell component="th">Requester</TableCell>
                    <TableCell component="th">Submitted</TableCell>
                    <TableCell component="th" align="right">
                      Review
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow
                      key={request.id}
                      hover
                      data-testid={`request-card-${request.id}`}
                    >
                      <TableCell>
                        <RequestStatus status={request.status} />
                      </TableCell>
                      <TableCell className="min-w-[300px] max-w-[480px]">
                        <div data-testid={`request-summary-${request.id}`}>
                          <RequestTarget request={request} compact />
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.requester?.name || 'Unavailable key'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {dateLabel(request.createdAt)}
                      </TableCell>
                      <TableCell align="right">{controls(request)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ))}
          {!loading && !error && totalPages > 1 && (
            <PageControls
              page={Math.min(page, totalPages)}
              totalPages={totalPages}
              onPageChange={state.setPage}
            />
          )}
        </CardContent>
      </Card>
      {selected && action === null && (
        <RequestDetailsDialog
          request={selected}
          loading={detailLoading}
          error={actionError}
          onClose={state.closeDetails}
          onAction={chooseAction}
        />
      )}
      {selected && action !== null && (
        <RequestActionDialog
          request={selected}
          action={action}
          reason={reason}
          setReason={state.setReason}
          grant={grantToRequestingKey}
          setGrant={state.setGrantToRequestingKey}
          error={actionError}
          submitting={submitting}
          onCancel={state.cancelAction}
          onSubmit={() => void state.submitAction()}
        />
      )}
    </div>
  );
};
export default RequestsPage;
