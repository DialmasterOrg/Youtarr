import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import DownloadFormatIndicator from './DownloadFormatIndicator';

const meta: Meta<typeof DownloadFormatIndicator> = {
  title: 'Components/Shared/DownloadFormatIndicator',
  component: DownloadFormatIndicator,
};

export default meta;

type Story = StoryObj<typeof DownloadFormatIndicator>;

export const VideoAndAudio: Story = {
  args: {
    filePath: '/downloads/video.mp4',
    audioFilePath: '/downloads/audio.mp3',
    fileSize: 1024 * 1024,
    audioFileSize: 2 * 1024 * 1024,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1MB')).toBeInTheDocument();
    await expect(canvas.getByText('2MB')).toBeInTheDocument();
  },
};

export const VideoOnly: Story = {
  args: {
    filePath: '/downloads/video.mp4',
    audioFilePath: null,
    fileSize: 1024 * 1024,
    audioFileSize: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('1MB')).toBeInTheDocument();
  },
};

export const AudioOnly: Story = {
  args: {
    filePath: null,
    audioFilePath: '/downloads/audio.mp3',
    fileSize: null,
    audioFileSize: 3 * 1024 * 1024,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('3MB')).toBeInTheDocument();
  },
};
