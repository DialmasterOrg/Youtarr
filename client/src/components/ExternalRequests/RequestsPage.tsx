import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ExternalLink,
  Download,
  Info,
  Key,
  Radio,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Video,
} from 'lucide-react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContentBody,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Checkbox,
  FormControlLabel,
  IconButton,
} from '../ui';
import RatingBadge from '../shared/RatingBadge';
import useMediaQuery from '../../hooks/useMediaQuery';
import {
  ExternalRequestRequester,
  ExternalRequestReview,
  ExternalRequestReviewPage,
  ExternalRequestStatus,
} from '../../types/externalRequest';

const STATUSES: ExternalRequestStatus[] = [
  'pending',
  'approved',
  'processing',
  'completed',
  'rejected',
  'failed',
  'cancelled',
];

const statusColor = (status: ExternalRequestStatus) => {
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'rejected' || status === 'cancelled') return 'error';
  if (status === 'processing' || status === 'approved') return 'info';
  return 'warning';
};

const formatLabel = (value: string) => value
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const requestTypeLabel = (type: ExternalRequestReview['type']) => {
  if (type === 'delete_video') return 'Video deletion';
  if (type === 'video') return 'Video download';
  return 'Channel';
};

const channelRequestLabel = (channelUrl?: string | null) => {
  if (!channelUrl) return 'Requested YouTube channel';
  try {
    const segment = new URL(channelUrl).pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : 'Requested YouTube channel';
  } catch {
    return 'Requested YouTube channel';
  }
};

const requestTargetLabel = (request: ExternalRequestReview) => {
  if (request.target.title) return request.target.title;
  if (request.type === 'channel') {
    return request.target.channelTitle || channelRequestLabel(request.target.channelUrl);
  }
  return request.target.youtubeId
    ? `YouTube video ${request.target.youtubeId}`
    : requestTypeLabel(request.type);
};

const requestTargetUrl = (request: ExternalRequestReview) => {
  if (request.type === 'channel') return request.target.channelUrl || null;
  return request.target.youtubeId
    ? `https://www.youtube.com/watch?v=${request.target.youtubeId}`
    : null;
};

const RequestStatusChip: React.FC<{ status: ExternalRequestStatus }> = ({ status }) => (
  <Chip
    label={formatLabel(status)}
    color={statusColor(status)}
    size="small"
  />
);

const RequestTarget: React.FC<{
  request: ExternalRequestReview;
  compact?: boolean;
}> = ({ request, compact = false }) => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const isChannel = request.type === 'channel';
  const label = requestTargetLabel(request);
  const channelLabel = request.target.channelTitle ||
    (isChannel ? 'New channel request' : 'Unknown channel');
  const thumbnailUrl = isChannel
    ? (request.target.youtubeChannelId
      ? `/images/channelthumb-${request.target.youtubeChannelId}.jpg`
      : null)
    : (request.target.youtubeId
      ? `https://i.ytimg.com/vi/${request.target.youtubeId}/mqdefault.jpg`
      : null);
  const targetUrl = requestTargetUrl(request);
  const typeIcon = request.type === 'delete_video'
    ? <Trash2 size={13} aria-hidden />
    : request.type === 'channel'
      ? <Radio size={13} aria-hidden />
      : <Video size={13} aria-hidden />;

  return (
    <div className="flex min-w-0 items-center gap-3" data-testid="request-target">
      {isChannel ? (
        <Avatar
          src={thumbnailFailed ? undefined : thumbnailUrl || undefined}
          alt={`${label} channel thumbnail`}
          size={compact ? 'medium' : 'large'}
          imgProps={{ onError: () => setThumbnailFailed(true) }}
          className="ring-1 ring-border"
        >
          <Radio size={18} aria-hidden />
        </Avatar>
      ) : (
        <div
          className={[
            'relative shrink-0 overflow-hidden rounded-[var(--radius-thumb)]',
            'border border-border bg-muted',
            compact ? 'h-[45px] w-20' : 'h-[54px] w-24',
          ].join(' ')}
        >
          {thumbnailUrl && !thumbnailFailed ? (
            <img
              src={thumbnailUrl}
              alt={`${label} thumbnail`}
              loading="lazy"
              onError={() => setThumbnailFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Video size={20} aria-hidden />
            </div>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-start gap-1">
          <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={label}>
            {label}
          </span>
          {targetUrl && (
            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${label} on YouTube`}
              className="shrink-0 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink size={15} aria-hidden />
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            label={requestTypeLabel(request.type)}
            icon={typeIcon}
            size="small"
            variant="outlined"
          />
          {!isChannel && (
            <span className="truncate text-xs text-muted-foreground">{channelLabel}</span>
          )}
          {(request.target.contentRating || request.target.rating) && (
            <RatingBadge rating={request.target.contentRating || request.target.rating} size="small" />
          )}
        </div>
      </div>
    </div>
  );
};

interface RequestsPageProps {
  token: string;
}

type ReviewAction = 'approve' | 'reject';

interface ApiErrorResponse {
  error?: string;
}

const errorMessage = (error: unknown, fallback: string) => (
  axios.isAxiosError<ApiErrorResponse>(error) && error.response?.data?.error
    ? error.response.data.error
    : fallback
);

const RequestsPage: React.FC<RequestsPageProps> = ({ token }) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [requests, setRequests] = useState<ExternalRequestReview[]>([]);
  const [requesters, setRequesters] = useState<ExternalRequestRequester[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState('');
  const [apiKeyId, setApiKeyId] = useState('');
  const [requestType, setRequestType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExternalRequestReview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [grantToRequestingKey, setGrantToRequestingKey] = useState(true);
  const detailRequestRef = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (status) params.set('status', status);
    if (apiKeyId) params.set('apiKeyId', apiKeyId);
    if (requestType) params.set('requestType', requestType);
    try {
      const response = await axios.get<ExternalRequestReviewPage>(`/api/external-requests?${params}`, {
        headers: { 'x-access-token': token },
        signal,
      });
      const body = response.data;
      setRequests(body.data);
      setRequesters(body.filterOptions.requesters);
      setTotalPages(body.pagination.totalPages);
    } catch (loadError) {
      if (!axios.isCancel(loadError) && !signal?.aborted) {
        setError(errorMessage(loadError, 'Unable to load requests'));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [apiKeyId, page, reloadToken, requestType, status, token]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const openDetail = async (request: ExternalRequestReview) => {
    const requestSequence = ++detailRequestRef.current;
    setSelected(request);
    setDetailLoading(true);
    setActionError(null);
    try {
      const response = await axios.get<ExternalRequestReview>(`/api/external-requests/${request.id}`, {
        headers: { 'x-access-token': token },
      });
      if (requestSequence === detailRequestRef.current) setSelected(response.data);
    } catch (detailError) {
      if (requestSequence === detailRequestRef.current) {
        setActionError(errorMessage(detailError, 'Unable to load request details'));
      }
    } finally {
      if (requestSequence === detailRequestRef.current) setDetailLoading(false);
    }
  };

  const beginInlineAction = (request: ExternalRequestReview, nextAction: ReviewAction) => {
    if (submitting || request.status !== 'pending') return;
    ++detailRequestRef.current;
    setDetailLoading(false);
    setSelected(request);
    setActionError(null);
    setReason('');
    setAction(nextAction);
  };

  const closeDetails = () => {
    ++detailRequestRef.current;
    setSelected(null);
    setAction(null);
    setDetailLoading(false);
  };

  const metadata = (request: ExternalRequestReview) => (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Chip
        label="Downloaded"
        size="small"
        variant="outlined"
        icon={<Download size={12} aria-hidden="true" />}
      />
      <RatingBadge
        rating={request.target.contentRating || request.target.rating}
        showNA
        size="small"
      />
      <span className="text-muted-foreground">
        {request.target.channelTitle || `Channel ${request.target.channelId}`}
      </span>
    </div>
  );

  const submitAction = async () => {
    if (!selected || !action) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await axios.post<ExternalRequestReview>(
        `/api/external-requests/${selected.id}/${action}`,
        action === 'reject'
          ? { reason }
          : (selected.type === 'channel' ? { grantToRequestingKey } : {}),
        {
        headers: {
          'x-access-token': token,
        },
        }
      );
      setSelected(response.data);
      setAction(null);
      setReason('');
      setReloadToken((value) => value + 1);
    } catch (reviewError) {
      setActionError(errorMessage(reviewError, `Unable to ${action} request`));
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = (value: string) => {
    setStatus(value);
    setPage(1);
  };
  const changeRequester = (value: string) => {
    setApiKeyId(value);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Typography variant="h5">External Requests</Typography>
          <Typography variant="body2" color="secondary">
            Review video, channel, and deletion requests submitted by approved external clients.
          </Typography>
        </div>
        <Button asChild variant="outlined" size="small" className="w-full sm:w-auto">
          <Link to="/settings/api-keys">
            <Key size={16} aria-hidden />
            Manage API keys
          </Link>
        </Button>
      </div>

      <Card variant="outlined">
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(150px,0.8fr)_minmax(220px,1.2fr)_minmax(170px,0.9fr)_auto] xl:items-end">
            <div>
              <Typography variant="caption" color="secondary">Status</Typography>
              <Select
                value={status}
                onValueChange={changeStatus}
                fullWidth
                size="small"
                inputProps={{ 'aria-label': 'Filter by status' }}
              >
                <MenuItem value="">All statuses</MenuItem>
                {STATUSES.map((value) => (
                  <MenuItem key={value} value={value}>{formatLabel(value)}</MenuItem>
                ))}
              </Select>
            </div>
            <div>
              <Typography variant="caption" color="secondary">Requester</Typography>
              <Select
                value={apiKeyId}
                onValueChange={changeRequester}
                fullWidth
                size="small"
                inputProps={{ 'aria-label': 'Filter by requester' }}
              >
                <MenuItem value="">All requesters</MenuItem>
                {requesters.map((requester) => (
                  <MenuItem key={requester.id} value={String(requester.id)}>
                    {requester.name} ({requester.keyPrefix})
                  </MenuItem>
                ))}
              </Select>
            </div>
            <div>
              <Typography variant="caption" color="secondary">Type</Typography>
              <Select
                value={requestType}
                onValueChange={(value) => {
                  setRequestType(value);
                  setPage(1);
                }}
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
              onClick={() => setReloadToken((value) => value + 1)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Refresh
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-3 py-12" role="status">
              <CircularProgress size={24} />
              <Typography variant="body2">Loading requests…</Typography>
            </div>
          )}

          {!loading && error && (
            <Alert severity="error">
              <div className="space-y-2">
                <Typography variant="body2">{error}</Typography>
                <Button size="small" variant="outlined" onClick={() => setReloadToken((value) => value + 1)}>
                  Retry
                </Button>
              </div>
            </Alert>
          )}

          {!loading && !error && requests.length === 0 && (
            <div className="py-12 text-center">
              <Typography variant="body1">No requests match these filters.</Typography>
              <Typography variant="body2" color="secondary">
                New video requests will appear here for review.
              </Typography>
            </div>
          )}

          {!loading && !error && requests.length > 0 && (
            <>
              {isDesktop ? (
              <div>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell component="th">Status</TableCell>
                        <TableCell component="th">Request</TableCell>
                        <TableCell component="th">Requester</TableCell>
                        <TableCell component="th">Submitted</TableCell>
                        <TableCell component="th" align="right">Review</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {requests.map((request) => (
                        <TableRow key={request.id} hover>
                          <TableCell>
                            <RequestStatusChip status={request.status} />
                          </TableCell>
                          <TableCell className="min-w-[300px] max-w-[480px]">
                            <div data-testid={`request-summary-${request.id}`}>
                              <RequestTarget request={request} compact />
                              {metadata(request)}
                            </div>
                          </TableCell>
                          <TableCell>{request.requester?.name || 'Unavailable key'}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(request.createdAt)}</TableCell>
                          <TableCell align="right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="small" variant="outlined" onClick={() => void openDetail(request)}>
                                Details
                              </Button>
                              <IconButton
                                size="small"
                                title="Approve request"
                                aria-label="Approve request"
                                color="success"
                                disabled={request.status !== 'pending' || submitting}
                                onClick={() => beginInlineAction(request, 'approve')}
                              >
                                <ThumbsUp size={16} />
                              </IconButton>
                              <IconButton
                                size="small"
                                title="Reject request"
                                aria-label="Reject request"
                                color="error"
                                disabled={request.status !== 'pending' || submitting}
                                onClick={() => beginInlineAction(request, 'reject')}
                              >
                                <ThumbsDown size={16} />
                              </IconButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
              ) : (
              <div
                className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3"
                aria-label="Request cards"
              >
                {requests.map((request) => (
                  <Card
                    key={request.id}
                    variant="outlined"
                    className="w-full min-w-0 hover:transform-none"
                    data-testid={`request-card-${request.id}`}
                  >
                    <CardContent className="min-w-0 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <RequestStatusChip status={request.status} />
                        <Typography variant="caption" color="secondary">
                          {formatDate(request.createdAt)}
                        </Typography>
                      </div>
                      <div data-testid={`request-summary-${request.id}`}>
                        <RequestTarget request={request} />
                        {metadata(request)}
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                        <div className="min-w-0">
                          <Typography variant="caption" color="secondary">Requester</Typography>
                          <div className="truncate text-sm text-foreground">
                            {request.requester?.name || 'Unavailable key'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="small" variant="outlined" onClick={() => void openDetail(request)}>
                            Details
                          </Button>
                          <IconButton
                            size="small"
                            title="Approve request"
                            aria-label="Approve request"
                            color="success"
                            disabled={request.status !== 'pending' || submitting}
                            onClick={() => beginInlineAction(request, 'approve')}
                          >
                            <ThumbsUp size={16} />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Reject request"
                            aria-label="Reject request"
                            color="error"
                            disabled={request.status !== 'pending' || submitting}
                            onClick={() => beginInlineAction(request, 'reject')}
                          >
                            <ThumbsDown size={16} />
                          </IconButton>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              )}
            </>
          )}

          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-end gap-3">
              <Button
                size="small"
                variant="outlined"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Typography variant="body2">Page {page} of {totalPages}</Typography>
              <Button
                size="small"
                variant="outlined"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selected !== null && action === null}
        onClose={closeDetails}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle onClose={closeDetails}>Request details</DialogTitle>
        <DialogContentBody>
          {detailLoading && (
            <div className="flex justify-center py-8" role="status">
              <CircularProgress size={24} />
            </div>
          )}
          {selected && !detailLoading && (
            <div className="space-y-4">
              {actionError && <Alert severity="error">{actionError}</Alert>}
              <RequestTarget request={selected} />
              <div className="flex flex-wrap items-center gap-2">
                <RequestStatusChip status={selected.status} />
                {metadata(selected)}
              </div>
              <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-[auto,1fr] sm:gap-x-4 sm:gap-y-2">
                {selected.target.youtubeId && <>
                  <dt className="font-medium">YouTube ID</dt>
                  <dd className="break-all">{selected.target.youtubeId}</dd>
                </>}
                {selected.target.channelUrl && <>
                  <dt className="font-medium">YouTube channel</dt>
                  <dd>
                    <a
                      href={selected.target.channelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Open channel
                      <ExternalLink size={14} aria-hidden />
                    </a>
                  </dd>
                </>}
                <dt className="font-medium">Channel</dt>
                <dd>{selected.target.channelTitle ||
                  (selected.target.channelId
                    ? `Channel ${selected.target.channelId}`
                    : selected.type === 'channel' ? 'New channel' : '—')}</dd>
                <dt className="font-medium">Requester</dt>
                <dd>
                  {selected.requester
                    ? `${selected.requester.name} (${selected.requester.keyPrefix})`
                    : 'Unavailable key'}
                </dd>
                <dt className="font-medium">Submitted</dt>
                <dd>{formatDate(selected.createdAt)}</dd>
                <dt className="font-medium">Last updated</dt>
                <dd>{formatDate(selected.updatedAt)}</dd>
                {selected.job && (
                  <>
                    <dt className="font-medium">Download job</dt>
                    <dd>{formatLabel(selected.job.status)} · {selected.job.id}</dd>
                  </>
                )}
                {selected.message && (
                  <>
                    <dt className="font-medium">Message</dt>
                    <dd>{selected.message}</dd>
                  </>
                )}
              </dl>
            </div>
          )}
        </DialogContentBody>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={closeDetails}>Close</Button>
          {selected?.status === 'pending' && !detailLoading && (
            <>
              <Button variant="outlined" color="error" onClick={() => {
                setReason('');
                setActionError(null);
                setAction('reject');
              }}>
                Reject
              </Button>
              <Button variant="contained" color="primary" onClick={() => {
                setActionError(null);
                setGrantToRequestingKey(true);
                setAction('approve');
              }}>
                Approve
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={selected !== null && action !== null}
        onClose={() => !submitting && setAction(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm {action === 'approve' ? 'approval' : 'rejection'}
        </DialogTitle>
        <DialogContentBody className="space-y-4">
          <DialogContentText>
            {action === 'approve'
              ? selected?.type === 'channel'
                ? 'Youtarr will recheck the requester, resolve and provision the channel, then optionally grant it to that key.'
                : selected?.type === 'delete_video'
                  ? 'Youtarr will recheck the requester, grant, rating, and media policy before deleting the local video files.'
                  : 'Youtarr will recheck the requester, channel grant, catalog entry, media type, and rating policy before accepting the download.'
              : 'Rejecting this request is final. The client may submit a new request later.'}
          </DialogContentText>
          {action === 'reject' && (
            <TextField
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              inputProps={{ maxLength: 300 }}
              helperText={`${reason.trim().length}/300 characters`}
              multiline
              rows={3}
              fullWidth
              required
            />
          )}
          {action === 'approve' && selected?.type === 'channel' && (
            <FormControlLabel
              control={<Checkbox
                checked={grantToRequestingKey}
                onChange={(event) => setGrantToRequestingKey(event.target.checked)}
              />}
              label="Grant the provisioned channel to the requesting key"
            />
          )}
          {actionError && <Alert severity="error">{actionError}</Alert>}
        </DialogContentBody>
        <DialogActions>
          <Button variant="outlined" color="inherit" disabled={submitting} onClick={() => setAction(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={action === 'reject' ? 'error' : 'primary'}
            disabled={submitting || (action === 'reject' && reason.trim().length === 0)}
            loading={submitting}
            onClick={() => void submitAction()}
          >
            Confirm {action === 'approve' ? 'approval' : 'rejection'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default RequestsPage;
