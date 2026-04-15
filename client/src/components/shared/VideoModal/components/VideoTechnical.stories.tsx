import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import VideoTechnical from './VideoTechnical';
import type { VideoExtendedMetadata, VideoModalData } from '../types';

const downloadedVideo: VideoModalData = {
  youtubeId: 'tech456',
  title: 'Mastering Encoder Settings',
  channelName: 'Studio Lab',
  thumbnailUrl: 'https://i.ytimg.com/vi/tech456/hqdefault.jpg',
  duration: 1842,
  publishedAt: '2026-01-10T08:00:00.000Z',
  addedAt: '2026-01-12T14:45:00.000Z',
  mediaType: 'video',
  status: 'downloaded',
  isDownloaded: true,
  filePath: '/usr/src/app/data/downloads/Studio Lab/Mastering Encoder Settings.mp4',
  fileSize: 3221225472,
  audioFilePath: '/usr/src/app/data/downloads/Studio Lab/Mastering Encoder Settings.m4a',
  audioFileSize: 124780544,
  isProtected: true,
  isIgnored: false,
  normalizedRating: 'TV-14',
  ratingSource: 'metadata',
  databaseId: 24,
  channelId: 'studio-lab',
};

const downloadedMetadata: VideoExtendedMetadata = {
  description: null,
  viewCount: 82000,
  likeCount: 5300,
  commentCount: 182,
  tags: ['Encoding', 'Video'],
  categories: ['Tutorial'],
  uploadDate: '20260110',
  resolution: '2560x1440',
  width: 1440,
  height: 2560,
  fps: 60,
  aspectRatio: 0.56,
  language: 'en',
  isLive: false,
  wasLive: false,
  availability: 'public',
  channelFollowerCount: 120000,
  ageLimit: 0,
  webpageUrl: 'https://www.youtube.com/watch?v=tech456',
  relatedFiles: [
    {
      fileName: '/usr/src/app/data/downloads/Studio Lab/Mastering Encoder Settings.nfo',
      fileSize: 4096,
      type: 'NFO',
    },
    {
      fileName: '/usr/src/app/data/downloads/Studio Lab/Mastering Encoder Settings.jpg',
      fileSize: 240384,
      type: 'Thumbnail',
    },
  ],
  availableResolutions: [360, 720, 1080, 1440],
  downloadedTier: 1440,
};

const meta: Meta<typeof VideoTechnical> = {
  title: 'Shared/VideoModal/VideoTechnical',
  component: VideoTechnical,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    video: downloadedVideo,
    metadata: downloadedMetadata,
    loading: false,
  },
};

export default meta;
type Story = StoryObj<typeof VideoTechnical>;

export const DownloadedWithFiles: Story = {};

export const MissingVideoFile: Story = {
  args: {
    video: {
      ...downloadedVideo,
      status: 'missing',
      filePath: null,
      fileSize: null,
      audioFilePath: null,
      audioFileSize: null,
    },
    metadata: {
      ...downloadedMetadata,
      relatedFiles: null,
    },
  },
};

export const LoadingTechnicalData: Story = {
  args: {
    metadata: null,
    loading: true,
  },
};