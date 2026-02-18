import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import VideoChip from '../VideoChip';
import { VideoInfo } from '../types';

const video: VideoInfo = {
  youtubeId: 'abc123',
  url: 'https://youtube.com/watch?v=abc123',
  channelName: 'Sample Channel',
  videoTitle: 'Sample Video Title',
  duration: 120,
  media_type: 'short',
  isAlreadyDownloaded: true,
  isMembersOnly: false,
  publishedAt: Date.now(),
};

const meta: Meta<typeof VideoChip> = {
  title: 'Components/DownloadManager/VideoChip',
  component: VideoChip,
  args: {
    video,
    onDelete: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof VideoChip>;

export const ShowsHistoryPopover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const historyIcon = canvasElement.querySelector('button svg[data-testid="HistoryIcon"]');
    const historyButton = historyIcon?.closest('button');
    await expect(historyButton as HTMLElement).toBeInTheDocument();
    await userEvent.click(historyButton as HTMLElement);

    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('This video was previously downloaded')).toBeInTheDocument();
  },
};
