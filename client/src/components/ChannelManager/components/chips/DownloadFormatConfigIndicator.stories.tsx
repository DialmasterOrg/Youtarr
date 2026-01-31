import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import DownloadFormatConfigIndicator from './DownloadFormatConfigIndicator';

const meta: Meta<typeof DownloadFormatConfigIndicator> = {
  title: 'Components/ChannelManager/DownloadFormatConfigIndicator',
  component: DownloadFormatConfigIndicator,
  args: {
    audioFormat: null,
  },
};

export default meta;

type Story = StoryObj<typeof DownloadFormatConfigIndicator>;

export const VideoOnly: Story = {
  args: {
    audioFormat: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('video-format-icon')).toBeInTheDocument();
    await expect(canvas.queryByTestId('audio-format-icon')).not.toBeInTheDocument();
  },
};

export const VideoAndAudio: Story = {
  args: {
    audioFormat: 'video_mp3',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('video-format-icon')).toBeInTheDocument();
    await expect(canvas.getByTestId('audio-format-icon')).toBeInTheDocument();
  },
};

export const AudioOnly: Story = {
  args: {
    audioFormat: 'mp3_only',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId('video-format-icon')).not.toBeInTheDocument();
    await expect(canvas.getByTestId('audio-format-icon')).toBeInTheDocument();
  },
};
