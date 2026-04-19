import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import VideoActions from './VideoActions';
import type { VideoModalData } from '../types';

const baseVideo: VideoModalData = {
  youtubeId: 'abc123xyz',
  title: 'Inside the Studio Tour',
  channelName: 'Creative Channel',
  thumbnailUrl: 'https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg',
  duration: 1320,
  publishedAt: '2026-03-14T12:00:00.000Z',
  addedAt: '2026-03-15T09:30:00.000Z',
  mediaType: 'video',
  status: 'downloaded',
  isDownloaded: true,
  filePath: '/downloads/Creative Channel/Inside the Studio Tour.mp4',
  fileSize: 2147483648,
  audioFilePath: null,
  audioFileSize: null,
  isProtected: true,
  isIgnored: false,
  normalizedRating: 'PG-13',
  ratingSource: 'manual',
  databaseId: 42,
  channelId: 'creative-channel',
};

const meta: Meta<typeof VideoActions> = {
  title: 'Shared/VideoModal/VideoActions',
  component: VideoActions,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    video: baseVideo,
    onDelete: () => {},
    onProtectionToggle: () => {},
    onIgnoreToggle: () => {},
    onDownloadClick: () => {},
    onRatingClick: () => {},
    protectionLoading: false,
    isMobile: false,
  },
};

export default meta;
type Story = StoryObj<typeof VideoActions>;

export const DownloadedProtected: Story = {};

export const PendingDownloadUnrated: Story = {
  args: {
    video: {
      ...baseVideo,
      status: 'never_downloaded',
      isDownloaded: false,
      filePath: null,
      fileSize: null,
      isProtected: false,
      isIgnored: false,
      normalizedRating: null,
      ratingSource: null,
    },
  },
};

export const MobileActions: Story = {
  args: {
    isMobile: true,
    video: {
      ...baseVideo,
      status: 'missing',
      isDownloaded: true,
      isProtected: false,
      isIgnored: true,
      normalizedRating: 'TV-14',
      ratingSource: 'metadata',
    },
  },
};