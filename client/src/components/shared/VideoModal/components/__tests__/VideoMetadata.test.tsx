import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoModalData, VideoExtendedMetadata } from '../../types';

jest.mock('../../../../../lib/icons', () => {
  const React = require('react');
  const make = (testId: string) => function MockIcon() {
    return React.createElement('span', { 'data-testid': testId });
  };
  return {
    __esModule: true,
    Eye: make('IconEye'),
    ThumbsUp: make('IconThumbsUp'),
    CalendarToday: make('IconCalendar'),
    AccessTime: make('IconAccessTime'),
    ExpandMore: make('IconExpandMore'),
    ExpandLess: make('IconExpandLess'),
    FileDownload: make('IconDownloaded'),
  };
});

import VideoMetadata from '../VideoMetadata';

const baseVideo: VideoModalData = {
  youtubeId: 'abc',
  title: 'Test Video',
  channelName: 'Test Channel',
  thumbnailUrl: 'https://example.com/t.jpg',
  duration: 905,
  publishedAt: null,
  addedAt: null,
  mediaType: 'video',
  status: 'downloaded',
  isDownloaded: true,
  filePath: null,
  fileSize: null,
  audioFilePath: null,
  audioFileSize: null,
  isProtected: false,
  isIgnored: false,
  normalizedRating: null,
  ratingSource: null,
  databaseId: 1,
  channelId: 'UC1',
};

const baseMetadata: VideoExtendedMetadata = {
  description: null,
  viewCount: null,
  likeCount: null,
  commentCount: null,
  tags: null,
  categories: null,
  uploadDate: null,
  resolution: null,
  width: null,
  height: null,
  fps: null,
  aspectRatio: null,
  language: null,
  isLive: null,
  wasLive: null,
  availability: null,
  channelFollowerCount: null,
  ageLimit: null,
  webpageUrl: null,
  relatedFiles: null,
  availableResolutions: null,
  downloadedTier: null,
};

const renderMetadata = (
  videoOverride: Partial<VideoModalData> = {},
  metadata: VideoExtendedMetadata | null = null,
  loading = false
) =>
  render(
    <VideoMetadata
      video={{ ...baseVideo, ...videoOverride }}
      metadata={metadata}
      loading={loading}
    />
  );

describe('VideoMetadata', () => {
  test('always renders the channel name', () => {
    renderMetadata();
    expect(screen.getByText('Test Channel')).toBeInTheDocument();
  });

  test('formats duration with hours when over an hour (905s -> 15:05)', () => {
    renderMetadata({ duration: 905 });
    expect(screen.getByText('15:05')).toBeInTheDocument();
  });

  test('formats duration with hours segment when >= 3600s', () => {
    renderMetadata({ duration: 3725 });
    expect(screen.getByText('1:02:05')).toBeInTheDocument();
  });

  test('omits duration row when video.duration is null', () => {
    renderMetadata({ duration: null });
    expect(screen.queryByTestId('IconAccessTime')).not.toBeInTheDocument();
  });

  test('formats publishedAt YYYYMMDD upload date when present in metadata', () => {
    renderMetadata({}, { ...baseMetadata, uploadDate: '20260220' });
    // Locale-dependent; assert calendar icon and a 2026 substring is in the page
    expect(screen.getByTestId('IconCalendar')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  test('falls back to video.publishedAt ISO date when metadata.uploadDate missing', () => {
    renderMetadata({ publishedAt: '2025-06-01T00:00:00Z' });
    expect(screen.getByTestId('IconCalendar')).toBeInTheDocument();
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  test('hides date row when both metadata.uploadDate and video.publishedAt are missing', () => {
    renderMetadata({ publishedAt: null });
    expect(screen.queryByTestId('IconCalendar')).not.toBeInTheDocument();
  });

  test('hides date row when date string is unparseable', () => {
    renderMetadata({ publishedAt: 'not-a-date' });
    expect(screen.queryByTestId('IconCalendar')).not.toBeInTheDocument();
  });

  test('renders Downloaded pill when isDownloaded and addedAt are set', () => {
    renderMetadata({ isDownloaded: true, addedAt: '2026-04-20T16:20:00Z' });
    expect(screen.getByTestId('IconDownloaded')).toBeInTheDocument();
    expect(screen.getByText(/^Downloaded:/)).toBeInTheDocument();
  });

  test('hides Downloaded pill when video is not downloaded even if addedAt is set', () => {
    renderMetadata({ isDownloaded: false, addedAt: '2026-04-20T16:20:00Z' });
    expect(screen.queryByTestId('IconDownloaded')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Downloaded:/)).not.toBeInTheDocument();
  });

  test('hides Downloaded pill when addedAt is null', () => {
    renderMetadata({ isDownloaded: true, addedAt: null });
    expect(screen.queryByTestId('IconDownloaded')).not.toBeInTheDocument();
  });

  test('hides Downloaded pill when addedAt is unparseable', () => {
    renderMetadata({ isDownloaded: true, addedAt: 'garbage' });
    expect(screen.queryByTestId('IconDownloaded')).not.toBeInTheDocument();
  });

  test('formats view counts under 1000 with locale separators', () => {
    renderMetadata({}, { ...baseMetadata, viewCount: 850 });
    expect(screen.getByText('850')).toBeInTheDocument();
  });

  test('formats view counts in thousands as K with one decimal', () => {
    renderMetadata({}, { ...baseMetadata, viewCount: 12500 });
    expect(screen.getByText('12.5K')).toBeInTheDocument();
  });

  test('strips trailing .0 from K formatting', () => {
    renderMetadata({}, { ...baseMetadata, viewCount: 12000 });
    expect(screen.getByText('12K')).toBeInTheDocument();
  });

  test('formats view counts in millions as M', () => {
    renderMetadata({}, { ...baseMetadata, viewCount: 1_500_000 });
    expect(screen.getByText('1.5M')).toBeInTheDocument();
  });

  test('formats like counts with the same rules', () => {
    renderMetadata({}, { ...baseMetadata, likeCount: 2_000_000 });
    expect(screen.getByText('2M')).toBeInTheDocument();
    expect(screen.getByTestId('IconThumbsUp')).toBeInTheDocument();
  });

  test('omits view/like sections when both counts are null', () => {
    renderMetadata({}, baseMetadata);
    expect(screen.queryByTestId('IconEye')).not.toBeInTheDocument();
    expect(screen.queryByTestId('IconThumbsUp')).not.toBeInTheDocument();
  });

  test('renders the loading branch instead of stats/tags/description when loading', () => {
    // Even with full metadata, loading=true must hide stats, tags, and description text
    renderMetadata(
      {},
      {
        ...baseMetadata,
        viewCount: 1234,
        likeCount: 99,
        tags: ['react'],
        description: 'visible-when-not-loading',
      },
      true
    );
    expect(screen.queryByTestId('IconEye')).not.toBeInTheDocument();
    expect(screen.queryByTestId('IconThumbsUp')).not.toBeInTheDocument();
    expect(screen.queryByText('react')).not.toBeInTheDocument();
    expect(screen.queryByText('visible-when-not-loading')).not.toBeInTheDocument();
  });

  test('combines categories and tags, deduping, and limits to 6 visible chips', () => {
    renderMetadata(
      {},
      {
        ...baseMetadata,
        categories: ['Music', 'Engineering'],
        tags: ['React', 'Engineering', 'Storybook', 'TS', 'UX', 'A11y', 'Hidden'],
      }
    );

    // First 6 visible (categories first, then tags, deduped)
    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Storybook')).toBeInTheDocument();
    expect(screen.getByText('TS')).toBeInTheDocument();
    expect(screen.getByText('UX')).toBeInTheDocument();
    // 7th (A11y) and 8th (Hidden) should be behind the +N more chip
    expect(screen.queryByText('A11y')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  test('clicking +N more reveals all tags and shows a Show less chip', () => {
    renderMetadata(
      {},
      {
        ...baseMetadata,
        tags: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'],
      }
    );

    fireEvent.click(screen.getByText('+2 more'));

    expect(screen.getByText('t7')).toBeInTheDocument();
    expect(screen.getByText('t8')).toBeInTheDocument();
    expect(screen.getByText('Show less')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Show less'));
    expect(screen.queryByText('t7')).not.toBeInTheDocument();
  });

  test('omits tags block entirely when there are no tags or categories', () => {
    renderMetadata({}, baseMetadata);
    // No tag-related text should be present
    expect(screen.queryByText('+1 more')).not.toBeInTheDocument();
    expect(screen.queryByText('Show less')).not.toBeInTheDocument();
  });

  test('shows description without truncation control when shorter than 300 chars', () => {
    const shortDesc = 'Just a short description.';
    renderMetadata({}, { ...baseMetadata, description: shortDesc });
    expect(screen.getByText(shortDesc)).toBeInTheDocument();
    expect(screen.queryByText('Show more')).not.toBeInTheDocument();
  });

  test('shows Show more / Show less toggle when description exceeds 300 chars', () => {
    const longDesc = 'a'.repeat(400);
    renderMetadata({}, { ...baseMetadata, description: longDesc });

    expect(screen.getByText('Show more')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Show more'));
    expect(screen.getByText('Show less')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Show less'));
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  test('omits description block when description is null', () => {
    renderMetadata({}, baseMetadata);
    expect(screen.queryByText('Show more')).not.toBeInTheDocument();
  });
});
