import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import ChannelCard from './ChannelCard';
import { Channel } from '../../../types/Channel';

const meta: Meta<typeof ChannelCard> = {
  title: 'Components/ChannelManager/ChannelCard',
  component: ChannelCard,
  parameters: {
    docs: {
      disable: true,
    },
  },
  args: {
    onNavigate: fn(),
    onDelete: fn(),
    onRegexClick: fn(),
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
  title_filter_regex: '.*',
};

export const Default: Story = {
  args: {
    channel: mockChannel,
    isMobile: false,
    globalPreferredResolution: '1080p',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    args.onNavigate.mockClear();

    const removeButton = canvas.getByRole('button', { name: /remove channel/i });
    await userEvent.click(removeButton);
    await expect(args.onDelete).toHaveBeenCalledTimes(1);

    const regexChip = canvas.getByTestId('regex-filter-chip');
    await userEvent.click(regexChip);
    await expect(args.onRegexClick).toHaveBeenCalled();
    await expect(args.onRegexClick).toHaveBeenCalledWith(expect.anything(), mockChannel.title_filter_regex);

    const card = canvas.getByTestId(`channel-card-${mockChannel.channel_id}`);
    const initialNavigateCalls = args.onNavigate.mock.calls.length;
    await userEvent.click(card);
    await expect(args.onNavigate.mock.calls.length).toBeGreaterThan(initialNavigateCalls);
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
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const pendingChip = canvas.getByText(/pending/i);
    await expect(pendingChip).toBeVisible();

    const card = canvas.getByTestId(`channel-card-${mockChannel.url}`);
    await expect(card).toHaveAttribute('disabled');
  },
};
