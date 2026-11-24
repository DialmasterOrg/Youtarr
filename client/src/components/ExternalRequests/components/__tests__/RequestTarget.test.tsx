import React from 'react';
import { render, screen } from '@testing-library/react';
import RequestTarget, { RequestStatus, requestChannelLabel } from '../RequestTarget';
import { ExternalRequestReview } from '../../../../types/externalRequest';

const baseRequest: ExternalRequestReview = {
  id: 'request-1',
  type: 'video',
  status: 'pending',
  requester: null,
  target: {
    youtubeId: 'abcdefghijk',
    channelId: null,
    youtubeChannelId: null,
    channelTitle: null,
    title: null,
    mediaType: 'video',
    rating: null,
  },
  job: null,
  createdAt: '2026-07-26T12:00:00.000Z',
  updatedAt: '2026-07-26T12:00:00.000Z',
};

const channelRequest: ExternalRequestReview = {
  ...baseRequest,
  type: 'channel',
  target: { ...baseRequest.target, youtubeId: null, channelUrl: 'https://www.youtube.com/@safechannel' },
};

describe('requestChannelLabel', () => {
  test('describes a pending channel request without a resolved channel', () => {
    expect(requestChannelLabel(channelRequest)).toBe('New channel request');
  });

  test('uses the channel title when the request has one', () => {
    expect(requestChannelLabel({ ...baseRequest, target: { ...baseRequest.target, channelTitle: 'Safe Channel' } }))
      .toBe('Safe Channel');
  });

  test('never shows a database id or null for a video with no known channel', () => {
    expect(requestChannelLabel({ ...baseRequest, target: { ...baseRequest.target, channelId: 42 } }))
      .toBe('Unknown channel');
  });
});

describe('RequestTarget', () => {
  test('labels an untitled video by its YouTube id', () => {
    render(<RequestTarget request={baseRequest} />);

    expect(screen.getByText('YouTube video abcdefghijk')).toBeInTheDocument();
  });

  test('labels an unresolved channel request by its URL handle', () => {
    render(<RequestTarget request={channelRequest} />);

    expect(screen.getByText('@safechannel')).toBeInTheDocument();
  });

  test('links a video request to YouTube', () => {
    render(<RequestTarget request={baseRequest} />);

    expect(screen.getByRole('link', { name: 'Open YouTube video abcdefghijk on YouTube' }))
      .toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk');
  });

  test('names the request type', () => {
    render(<RequestTarget request={{ ...baseRequest, type: 'delete_video' }} />);

    expect(screen.getByText('Video deletion')).toBeInTheDocument();
  });
});

describe('RequestStatus', () => {
  test('capitalizes the status', () => {
    render(<RequestStatus status="processing" />);

    expect(screen.getByText('Processing')).toBeInTheDocument();
  });
});
