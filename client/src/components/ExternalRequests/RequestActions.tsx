import React from 'react';
import { Info, ThumbsDown, ThumbsUp } from 'lucide-react';
import { IconButton } from '../ui';
import { ExternalRequestReview } from '../../types/externalRequest';
import {
  canApproveRequest,
  canRejectRequest,
  ReviewAction,
} from './requestPolicy';
interface Props {
  request: ExternalRequestReview;
  submitting: boolean;
  onDetails: () => void;
  onAction: (action: ReviewAction) => void;
}
export default function RequestActions({
  request,
  submitting,
  onDetails,
  onAction,
}: Props) {
  const approveLabel =
    request.status === 'approved' ? 'Retry approval' : 'Approve request';
  return (
    <div className="flex items-center justify-end gap-1">
      <IconButton
        size="small"
        title="View request details"
        aria-label="Details"
        disabled={submitting}
        onClick={onDetails}
      >
        <Info size={16} />
      </IconButton>
      <IconButton
        size="small"
        title={approveLabel}
        aria-label={approveLabel}
        color="success"
        disabled={submitting || !canApproveRequest(request)}
        onClick={() => onAction('approve')}
      >
        <ThumbsUp size={16} />
      </IconButton>
      <IconButton
        size="small"
        title="Reject request"
        aria-label="Reject request"
        color="error"
        disabled={submitting || !canRejectRequest(request)}
        onClick={() => onAction('reject')}
      >
        <ThumbsDown size={16} />
      </IconButton>
    </div>
  );
}
