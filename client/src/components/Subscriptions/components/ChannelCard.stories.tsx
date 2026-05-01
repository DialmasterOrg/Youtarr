import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import ChannelCard from './ChannelCard';
import type { Channel } from '../../../types/Channel';

const mockChannel: Channel = {
  url: 'https://www.youtube.com/@Blippi',
  uploader: 'Blippi - Educational Videos for Kids',
  channel_id: 'UCqbFauZW_Gbc4kLVMRr_6Ow',
  description: 'Fun educational videos for kids',
  video_quality: '1080',
  audio_format: 'mp4',
  sub_folder: 'Blippi',
  auto_download_enabled_tabs: 'uploads',
  available_tabs: 'uploads,videos,shorts',
};

const minimalChannel: Channel = {
  url: 'https://www.youtube.com/@Cercle',
  uploader: 'Cercle',
};

const audioOnlyChannel: Channel = {
  url: 'https://www.youtube.com/@NFL',
  uploader: 'NFL',
  channel_id: 'UCDVYQ4Zhbm3S2dlz7P1GBDg',
  video_quality: 'audio_only',
  audio_format: 'mp3',
  auto_download_enabled_tabs: 'uploads',
};

const meta: Meta<typeof ChannelCard> = {
  title: 'Subscriptions/ChannelCard',
  component: ChannelCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
  args: {
    channel: mockChannel,
    isMobile: false,
    globalPreferredResolution: '1080',
    onNavigate: () => {},
    onDelete: () => {},
    onRegexClick: () => {},
    isPendingAddition: false,
  },
};

export default meta;
type Story = StoryObj<typeof ChannelCard>;

export const Default: Story = {};

export const Mobile: Story = { args: { isMobile: true } };

export const PendingAddition: Story = { args: { isPendingAddition: true } };

export const MinimalChannel: Story = {
  args: { channel: minimalChannel },
};

export const AudioOnlyChannel: Story = {
  args: {
    channel: audioOnlyChannel,
    globalPreferredResolution: 'audio_only',
  },
};

export const WithQualityMismatch: Story = {
  args: {
    channel: { ...mockChannel, video_quality: '720' },
    globalPreferredResolution: '1080',
  },
  name: 'Quality Mismatch (720 vs global 1080)',
};

export const WithDurationFilter: Story = {
  args: {
    channel: { ...mockChannel, min_duration: 300, max_duration: 3600 },
  },
};

export const WithTitleFilter: Story = {
  args: {
    channel: { ...mockChannel, title_filter_regex: '^(?!.*Short).*$' },
  },
};

export const ChannelGrid: Story = {
  render: (args) => (
    <div className="grid grid-cols-2 gap-4 w-[600px]">
      <ChannelCard {...args} channel={mockChannel} />
      <ChannelCard {...args} channel={audioOnlyChannel} />
      <ChannelCard {...args} channel={minimalChannel} />
      <ChannelCard {...args} channel={{ ...mockChannel, uploader: 'The Daily Show', channel_id: undefined }} />
    </div>
  ),
};
