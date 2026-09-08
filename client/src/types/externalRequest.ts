export type ExternalRequestStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export interface ExternalRequestRequester {
  id: number;
  name: string;
  keyPrefix: string;
  role: string;
  isActive: boolean;
  revokedAt: string | null;
}

export interface ExternalRequestReview {
  id: string;
  type: 'video' | 'channel' | 'delete_video';
  status: ExternalRequestStatus;
  requester: ExternalRequestRequester | null;
  target: {
    youtubeId: string | null;
    channelId: number | null;
    channelUrl?: string | null;
    youtubeChannelId: string | null;
    channelTitle: string | null;
    title: string | null;
    mediaType: string | null;
    rating: string | null;
    contentRating?: string | null;
  };
  job: {
    id: string;
    status: string;
    type: string;
    createdAt: string;
    startedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  completedAt?: string;
  message?: string;
  grantToRequestingKey?: boolean;
}

export interface ExternalRequestReviewPage {
  data: ExternalRequestReview[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filterOptions: {
    requesters: ExternalRequestRequester[];
  };
}
