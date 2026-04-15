import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import VideoMetadata from './VideoMetadata';
import type { VideoExtendedMetadata, VideoModalData } from '../types';

const baseVideo: VideoModalData = {
  youtubeId: 'meta123',
  title: 'How We Built the New Detail View',
  channelName: 'Engineering Notes',
  thumbnailUrl: 'https://i.ytimg.com/vi/meta123/hqdefault.jpg',
  duration: 905,
  publishedAt: '2026-02-20T10:15:00.000Z',
  addedAt: '2026-02-22T09:00:00.000Z',
  mediaType: 'video',
  status: 'downloaded',
  isDownloaded: true,
  filePath: '/downloads/Engineering Notes/How We Built the New Detail View.mp4',
  fileSize: 1493823488,
  audioFilePath: null,
  audioFileSize: null,
  isProtected: false,
  isIgnored: false,
  normalizedRating: 'PG',
  ratingSource: 'manual',
  databaseId: 9,
  channelId: 'engineering-notes',
};

const richMetadata: VideoExtendedMetadata = {
  description:
    'A long-form breakdown of the new video detail surface, covering interaction affordances, technical metadata, and how we kept the mobile and desktop layouts aligned.\n\nWe also walk through the Storybook strategy for each section and why the action row keeps destructive actions separated from discovery actions.',
  viewCount: 182340,
  likeCount: 12450,
  commentCount: 410,
  tags: ['React', 'Testing', 'Storybook', 'UX', 'Accessibility', 'TypeScript'],
  categories: ['Engineering', 'Frontend'],
  uploadDate: '20260220',
  resolution: '1920x1080',
  width: 1920,
  height: 1080,
  fps: 30,
  aspectRatio: 1.78,
  language: 'en',
  isLive: false,
  wasLive: false,
  availability: 'public',
  channelFollowerCount: 240000,
  ageLimit: 0,
  webpageUrl: 'https://www.youtube.com/watch?v=meta123',
  relatedFiles: null,
  availableResolutions: [360, 720, 1080],
  downloadedTier: 1080,
};

const meta: Meta<typeof VideoMetadata> = {
  title: 'Shared/VideoModal/VideoMetadata',
  component: VideoMetadata,
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
    video: baseVideo,
    metadata: richMetadata,
    loading: false,
  },
};

export default meta;
type Story = StoryObj<typeof VideoMetadata>;

export const RichMetadata: Story = {};

export const LoadingState: Story = {
  args: {
    metadata: null,
    loading: true,
  },
};

export const SparseMetadata: Story = {
  args: {
    metadata: {
      ...richMetadata,
      description: null,
      tags: [],
      categories: [],
      likeCount: null,
      viewCount: null,
    },
  },
};