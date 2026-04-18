import React from 'react';
import { render, screen } from '@testing-library/react';
import { VideoModalData, VideoExtendedMetadata } from '../../types';

import VideoTechnical from '../VideoTechnical';

const baseVideo: VideoModalData = {
  youtubeId: 'YT_ID_1',
  title: 'Test',
  channelName: 'Chan',
  thumbnailUrl: 'https://x/y',
  duration: 100,
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

const renderTech = (
  videoOverride: Partial<VideoModalData> = {},
  metadata: VideoExtendedMetadata | null = null,
  loading = false
) =>
  render(
    <VideoTechnical
      video={{ ...baseVideo, ...videoOverride }}
      metadata={metadata}
      loading={loading}
    />
  );

describe('VideoTechnical', () => {
  describe('Video Details accordion', () => {
    test('always shows the YouTube ID', () => {
      renderTech();
      expect(screen.getByText('Video ID')).toBeInTheDocument();
      expect(screen.getByText('YT_ID_1')).toBeInTheDocument();
    });

    test('shows downloaded resolution as WIDTHxHEIGHT when matching tier', () => {
      renderTech({}, { ...baseMetadata, width: 1920, height: 1080, downloadedTier: 1080 });
      expect(screen.getByText('Downloaded')).toBeInTheDocument();
      expect(screen.getByText('1920x1080')).toBeInTheDocument();
    });

    test('appends tier label when tier differs from height (non-16:9)', () => {
      renderTech({}, { ...baseMetadata, width: 1080, height: 1440, downloadedTier: 1080 });
      expect(screen.getByText('1080x1440 (1080p)')).toBeInTheDocument();
    });

    test('falls back to "Hp" format when width is missing', () => {
      renderTech({}, { ...baseMetadata, width: null, height: 720, downloadedTier: null });
      expect(screen.getByText('720p')).toBeInTheDocument();
    });

    test('omits Downloaded row when video is not downloaded', () => {
      renderTech({ isDownloaded: false }, { ...baseMetadata, height: 1080, width: 1920 });
      expect(screen.queryByText('Downloaded')).not.toBeInTheDocument();
    });

    test('omits Downloaded row when metadata height is missing', () => {
      renderTech({ isDownloaded: true }, { ...baseMetadata, height: null });
      expect(screen.queryByText('Downloaded')).not.toBeInTheDocument();
    });

    test('shows FPS, aspect ratio with orientation, and language when provided', () => {
      renderTech(
        {},
        { ...baseMetadata, fps: 60, aspectRatio: 1.78, language: 'en' }
      );
      expect(screen.getByText('FPS')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
      expect(screen.getByText('Aspect Ratio')).toBeInTheDocument();
      expect(screen.getByText('1.78 (Landscape)')).toBeInTheDocument();
      expect(screen.getByText('Language')).toBeInTheDocument();
      expect(screen.getByText('en')).toBeInTheDocument();
    });

    test('labels portrait and square aspect ratios', () => {
      const { rerender } = renderTech({}, { ...baseMetadata, aspectRatio: 0.56 });
      expect(screen.getByText('0.56 (Portrait)')).toBeInTheDocument();

      rerender(
        <VideoTechnical
          video={baseVideo}
          metadata={{ ...baseMetadata, aspectRatio: 1.0 }}
          loading={false}
        />
      );
      expect(screen.getByText('1.00 (Square)')).toBeInTheDocument();
    });

    test('hides aspect ratio when value is not numeric', () => {
      renderTech(
        {},
        { ...baseMetadata, aspectRatio: 'wide' as unknown as number }
      );
      expect(screen.queryByText('Aspect Ratio')).not.toBeInTheDocument();
    });

    test('hides metadata-derived rows while loading', () => {
      renderTech(
        {},
        { ...baseMetadata, fps: 60, language: 'en' },
        true
      );
      expect(screen.queryByText('FPS')).not.toBeInTheDocument();
      expect(screen.queryByText('Language')).not.toBeInTheDocument();
      // YouTube ID still always shows
      expect(screen.getByText('YT_ID_1')).toBeInTheDocument();
    });
  });

  describe('Available resolutions chips', () => {
    test('renders one chip per resolution', () => {
      renderTech({}, { ...baseMetadata, availableResolutions: [360, 720, 1080] });
      expect(screen.getByText('Available Resolutions')).toBeInTheDocument();
      expect(screen.getByText('360p')).toBeInTheDocument();
      expect(screen.getByText('720p')).toBeInTheDocument();
      expect(screen.getByText('1080p')).toBeInTheDocument();
    });

    test('omits the section when availableResolutions is null', () => {
      renderTech({}, baseMetadata);
      expect(screen.queryByText('Available Resolutions')).not.toBeInTheDocument();
    });

    test('hides the section while loading', () => {
      renderTech({}, { ...baseMetadata, availableResolutions: [360] }, true);
      expect(screen.queryByText('Available Resolutions')).not.toBeInTheDocument();
    });
  });

  describe('File Details accordion', () => {
    test('does not render File Details when video is neither downloaded nor missing', () => {
      renderTech({ isDownloaded: false, status: 'never_downloaded' });
      expect(screen.queryByText('File Details')).not.toBeInTheDocument();
    });

    test('renders File Details when status is missing even if not downloaded', () => {
      renderTech({ isDownloaded: false, status: 'missing' });
      expect(screen.getByText('File Details')).toBeInTheDocument();
    });

    test('renders the video file row with stripped internal path and formatted size', () => {
      renderTech({
        filePath: '/usr/src/app/data/Channel/video.mp4',
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB
      });
      expect(screen.getByText('Video')).toBeInTheDocument();
      expect(screen.getByText('5.00 GB')).toBeInTheDocument();
      expect(screen.getByText('Channel/video.mp4')).toBeInTheDocument();
    });

    test('formats sizes in MB, KB, and B', () => {
      const { rerender } = renderTech({
        filePath: '/file.mp4',
        fileSize: 2 * 1024 * 1024,
      });
      expect(screen.getByText('2.0 MB')).toBeInTheDocument();

      rerender(
        <VideoTechnical
          video={{ ...baseVideo, filePath: '/file.mp4', fileSize: 1500 }}
          metadata={null}
          loading={false}
        />
      );
      expect(screen.getByText('1.5 KB')).toBeInTheDocument();

      rerender(
        <VideoTechnical
          video={{ ...baseVideo, filePath: '/file.mp4', fileSize: 500 }}
          metadata={null}
          loading={false}
        />
      );
      expect(screen.getByText('500 B')).toBeInTheDocument();
    });

    test('shows "Unknown size" when file size is missing', () => {
      renderTech({ filePath: '/file.mp4', fileSize: null });
      expect(screen.getByText('Unknown size')).toBeInTheDocument();
    });

    test('renders an audio file row when audioFilePath is set', () => {
      renderTech({
        filePath: null,
        audioFilePath: '/usr/src/app/data/Channel/audio.m4a',
        audioFileSize: 2 * 1024 * 1024,
      });
      expect(screen.getByText('Audio')).toBeInTheDocument();
      expect(screen.getByText('Channel/audio.m4a')).toBeInTheDocument();
    });

    test('renders related files from metadata', () => {
      renderTech(
        { filePath: null, audioFilePath: null },
        {
          ...baseMetadata,
          relatedFiles: [
            { fileName: 'thumbnail.jpg', fileSize: 1024, type: 'thumbnail' },
            { fileName: 'subs.srt', fileSize: 0, type: 'subtitles' },
          ],
        }
      );
      expect(screen.getByText('thumbnail')).toBeInTheDocument();
      expect(screen.getByText('thumbnail.jpg')).toBeInTheDocument();
      expect(screen.getByText('subtitles')).toBeInTheDocument();
    });

    test('renders Added date when video.addedAt is parseable', () => {
      renderTech({ addedAt: '2025-06-01T00:00:00Z' });
      expect(screen.getByText('Added')).toBeInTheDocument();
      expect(screen.getByText(/2025/)).toBeInTheDocument();
    });

    test('omits Added row when addedAt is unparseable', () => {
      renderTech({ addedAt: 'garbage' });
      expect(screen.queryByText('Added')).not.toBeInTheDocument();
    });

    test('shows "No file details available" when no file info is present', () => {
      renderTech({ filePath: null, audioFilePath: null, addedAt: null });
      expect(screen.getByText('No file details available')).toBeInTheDocument();
    });

    test('does not include related files while loading', () => {
      renderTech(
        { filePath: null, audioFilePath: null },
        {
          ...baseMetadata,
          relatedFiles: [{ fileName: 'thumb.jpg', fileSize: 100, type: 'thumbnail' }],
        },
        true
      );
      expect(screen.queryByText('thumb.jpg')).not.toBeInTheDocument();
    });
  });
});
