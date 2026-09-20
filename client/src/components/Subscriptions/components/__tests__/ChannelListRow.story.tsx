import { MemoryRouter } from 'react-router-dom';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import ChannelListRow from '../ChannelListRow';
import { Channel } from '../../../../types/Channel';

const channel: Channel = {
  channel_id: 'UC123',
  title: 'Sample Channel',
  url: 'https://youtube.com/channel/UC123',
  description: 'Sample description',
  uploader: 'Sample Channel',
  video_quality: '1080p',
  min_duration: 0,
  max_duration: 0,
  title_filter_regex: '.*',
  available_tabs: 'videos,shorts,streams',
  auto_download_enabled_tabs: 'video',
  sub_folder: 'Default',
};

const meta: Meta<typeof ChannelListRow> = {
  title: 'Components/Subscriptions/ChannelListRow',
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  component: ChannelListRow,
  args: {
    channel,
    isMobile: false,
    globalPreferredResolution: '1080p',
    onDelete: fn(),
    onRegexClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ChannelListRow>;

export const Desktop: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /remove channel/i }));
    await expect(args.onDelete).toHaveBeenCalledTimes(1);

    await userEvent.click(canvas.getByTestId('regex-filter-chip'));
    await expect(args.onRegexClick).toHaveBeenCalled();

    await userEvent.click(canvas.getByTestId(`channel-list-row-${channel.channel_id}`));
    await expect(canvas.getByRole('link')).toHaveAttribute('href', `/channel/${channel.channel_id}`);
  },
};
