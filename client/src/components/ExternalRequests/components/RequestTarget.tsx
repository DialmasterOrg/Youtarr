import React, { useState } from 'react';
import { ExternalLink, Radio, Trash2, Video } from 'lucide-react';
import { Avatar, Chip } from '../../ui';
import RatingBadge from '../../shared/RatingBadge';
import { ExternalRequestReview, ExternalRequestStatus } from '../../../types/externalRequest';
import { requestStatusLabel } from '../requestPolicy';

type ChipColor = 'success' | 'error' | 'info' | 'warning';

const TYPE_LABELS: Record<ExternalRequestReview['type'], string> = {
  video: 'Video download',
  channel: 'Channel',
  delete_video: 'Video deletion',
};

const STATUS_COLORS: Record<ExternalRequestStatus, ChipColor> = {
  pending: 'warning',
  approved: 'info',
  processing: 'info',
  completed: 'success',
  rejected: 'error',
  failed: 'error',
  cancelled: 'error',
};

export const requestChannelLabel = (request: ExternalRequestReview) => {
  const { channelTitle, youtubeChannelId } = request.target;
  if (channelTitle) return channelTitle;
  if (youtubeChannelId) return youtubeChannelId;
  return request.type === 'channel' ? 'New channel request' : 'Unknown channel';
};

const targetLabel = (request: ExternalRequestReview) => {
  const { title, channelTitle, channelUrl, youtubeId } = request.target;
  if (title) return title;
  if (request.type === 'channel') {
    if (channelTitle) return channelTitle;
    return channelUrl?.split('/').filter(Boolean).pop() || 'Requested YouTube channel';
  }
  return youtubeId ? `YouTube video ${youtubeId}` : 'Request target';
};

const targetUrl = (request: ExternalRequestReview) => {
  if (request.type === 'channel') return request.target.channelUrl || null;
  return request.target.youtubeId ? `https://www.youtube.com/watch?v=${request.target.youtubeId}` : null;
};

const TypeIcon = ({ type }: { type: ExternalRequestReview['type'] }) => {
  if (type === 'delete_video') return <Trash2 size={13} aria-hidden />;
  if (type === 'channel') return <Radio size={13} aria-hidden />;
  return <Video size={13} aria-hidden />;
};

interface RequestTargetProps {
  request: ExternalRequestReview;
  compact?: boolean;
}

export default function RequestTarget({ request, compact = false }: RequestTargetProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const label = targetLabel(request);
  const url = targetUrl(request);
  const isChannel = request.type === 'channel';
  const rating = request.target.contentRating || request.target.rating;
  const channelThumbnail =
    !thumbnailFailed && request.target.youtubeChannelId
      ? `/images/channelthumb-${request.target.youtubeChannelId}.jpg`
      : undefined;

  return (
    <div className="flex min-w-0 items-center gap-3">
      {isChannel ? (
        <Avatar
          src={channelThumbnail}
          alt={`${label} channel thumbnail`}
          size={compact ? 'medium' : 'large'}
          imgProps={{ onError: () => setThumbnailFailed(true) }}
        >
          <Radio size={18} aria-hidden />
        </Avatar>
      ) : (
        <div
          className={`relative shrink-0 overflow-hidden rounded-[var(--radius-thumb)] border border-border bg-muted ${
            compact ? 'h-[45px] w-20' : 'h-[54px] w-24'
          }`}
        >
          {request.target.youtubeId && !thumbnailFailed ? (
            <img
              src={`https://i.ytimg.com/vi/${request.target.youtubeId}/mqdefault.jpg`}
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
          {url && (
            <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${label} on YouTube`}>
              <ExternalLink size={15} aria-hidden />
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            label={TYPE_LABELS[request.type]}
            icon={<TypeIcon type={request.type} />}
            size="small"
            variant="outlined"
          />
          {!isChannel && (
            <span className="truncate text-xs text-muted-foreground">{requestChannelLabel(request)}</span>
          )}
          {rating && <RatingBadge rating={rating} size="small" />}
        </div>
      </div>
    </div>
  );
}

export function RequestStatus({ status }: { status: ExternalRequestStatus }) {
  return <Chip label={requestStatusLabel(status)} color={STATUS_COLORS[status]} size="small" />;
}
