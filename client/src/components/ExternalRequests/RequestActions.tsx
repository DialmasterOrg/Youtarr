import React from 'react';
import { Info, ThumbsDown, ThumbsUp } from 'lucide-react';
import { IconButton } from '../ui';
import { ExternalRequestReview } from '../../types/externalRequest';
import { ReviewAction } from './hooks/useExternalRequests';
interface Props { request: ExternalRequestReview; submitting: boolean; onDetails: () => void; onAction: (action: ReviewAction) => void; }
export default function RequestActions({ request, submitting, onDetails, onAction }: Props) {
  const disabled = request.status !== 'pending' || submitting;
  return <div className="flex items-center justify-end gap-1"><IconButton size="small" title="View request details" aria-label="Details" onClick={onDetails}><Info size={16} /></IconButton><IconButton size="small" title="Approve request" aria-label="Approve request" color="success" disabled={disabled} onClick={() => onAction('approve')}><ThumbsUp size={16} /></IconButton><IconButton size="small" title="Reject request" aria-label="Reject request" color="error" disabled={disabled} onClick={() => onAction('reject')}><ThumbsDown size={16} /></IconButton></div>;
}
