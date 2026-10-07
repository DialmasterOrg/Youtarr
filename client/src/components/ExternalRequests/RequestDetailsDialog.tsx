import React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContentBody,
  DialogTitle,
} from '../ui';
import { ExternalRequestReview } from '../../types/externalRequest';
import RequestTarget, {
  requestChannelLabel,
  RequestStatus,
} from './RequestTarget';
import {
  canApproveRequest,
  canRejectRequest,
  ReviewAction,
} from './requestPolicy';
import { requestDateLabel as dateLabel } from './requestPolicy';

export default function RequestDetailsDialog({
  request,
  loading,
  error,
  onClose,
  onAction,
}: {
  request: ExternalRequestReview;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAction: (action: ReviewAction) => void;
}) {
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle onClose={onClose}>Request details</DialogTitle>
      <DialogContentBody>
        {loading ? (
          <div className="flex justify-center py-8" role="status">
            <CircularProgress size={24} />
          </div>
        ) : (
          <div className="space-y-4">
            {error && <Alert severity="error">{error}</Alert>}
            <RequestTarget request={request} />
            <div className="flex items-center gap-2">
              <RequestStatus status={request.status} />
            </div>
            <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-[auto,1fr] sm:gap-x-4 sm:gap-y-2">
              {request.target.youtubeId && (
                <>
                  <dt className="font-medium">YouTube ID</dt>
                  <dd className="break-all">{request.target.youtubeId}</dd>
                </>
              )}
              {request.target.channelUrl && (
                <>
                  <dt className="font-medium">YouTube channel</dt>
                  <dd>
                    <a
                      href={request.target.channelUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open channel <ExternalLink size={14} aria-hidden />
                    </a>
                  </dd>
                </>
              )}
              <dt className="font-medium">Channel</dt>
              <dd>{requestChannelLabel(request)}</dd>
              <dt className="font-medium">Requester</dt>
              <dd>
                {request.requester
                  ? `${request.requester.name} (${request.requester.keyPrefix})`
                  : 'Unavailable key'}
              </dd>
              <dt className="font-medium">Submitted</dt>
              <dd>{dateLabel(request.createdAt)}</dd>
              <dt className="font-medium">Last updated</dt>
              <dd>{dateLabel(request.updatedAt)}</dd>
              {request.job && (
                <>
                  <dt className="font-medium">Download job</dt>
                  <dd>
                    {request.job.status} - {request.job.id}
                  </dd>
                </>
              )}
              {request.message && (
                <>
                  <dt className="font-medium">Message</dt>
                  <dd>{request.message}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </DialogContentBody>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Close
        </Button>
        {!loading &&
          !error &&
          (canApproveRequest(request) || canRejectRequest(request)) && (
            <>
              <Button
                disabled={!canRejectRequest(request)}
                variant="outlined"
                color="error"
                onClick={() => onAction('reject')}
              >
                Reject
              </Button>
              <Button
                disabled={!canApproveRequest(request)}
                variant="contained"
                color="primary"
                onClick={() => onAction('approve')}
              >
                {request.status === 'approved' ? 'Retry approval' : 'Approve'}
              </Button>
            </>
          )}
      </DialogActions>
    </Dialog>
  );
}
