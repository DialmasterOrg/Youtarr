import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import ChannelCard from './ChannelCard';
import { Channel } from '../../../types/Channel';

const meta: Meta<typeof ChannelCard> = {
  title: 'Components/ChannelManager/ChannelCard',
  component: ChannelCard,
  tags: ['autodocs'],
  argTypes: {
    onNavigate: { action: 'navigated' },
    onDelete: { action: 'deleted' },
    onRegexClick: { action: 'regexClicked' },
  },
};

export default meta;
type Story = StoryObj<typeof ChannelCard>;

const mockChannel: Channel = {
    channel_id: 'UC_x5XG1OV2P6uYZ5FSM9Ptw',
    title: 'Example Channel',
    url: 'https://youtube.com/c/example',
    description: 'A sample channel description for Storybook.',
    uploader: 'Example Creator',
    video_quality: '1080p',
    min_duration: 0,
    max_duration: 0,
    title_filter_regex: '',
};

export const Default: Story = {
  args: {
    channel: mockChannel,
    isMobile: false,
    globalPreferredResolution: '1080p',
  },
};

export const Mobile: Story = {
  args: {
    channel: mockChannel,
    isMobile: true,
    globalPreferredResolution: '1080p',
  },
};

export const PendingAddition: Story = {
  args: {
    channel: { ...mockChannel, channel_id: '' },
    isMobile: false,
    globalPreferredResolution: '1080p',
    isPendingAddition: true,
  },
};
