import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import React from 'react';
import { ChannelVideo } from '../../types/ChannelVideo';
import { getStatusIcon, getStatusLabel, getVideoStatus } from '../videoStatus';

const StatusPreview = ({ video }: { video: ChannelVideo }) => {
  const status = getVideoStatus(video);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {getStatusIcon(status)}
      <span>{getStatusLabel(status)}</span>
    </div>
  );
};

const meta: Meta<typeof StatusPreview> = {
  title: 'Utilities/VideoStatus',
  component: StatusPreview,
  args: {
    video: {
      title: 'Sample Video',
      youtube_id: 'vid1',
      publishedAt: null,
      thumbnail: '',
      added: false,
      duration: 0,
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusPreview>;

export const NotDownloaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Not Downloaded')).toBeInTheDocument();
  },
};
