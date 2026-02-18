import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import VideoListItem from '../VideoListItem';
import { ChannelVideo } from '../../../types/ChannelVideo';

const video: ChannelVideo = {
  title: 'Sample Video',
  youtube_id: 'abc123',
  publishedAt: '2024-01-01T00:00:00Z',
  thumbnail: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
  added: false,
  removed: false,
  duration: 120,
  fileSize: 1024 * 1024,
  media_type: 'video',
  ignored: false,
};

const meta: Meta<typeof VideoListItem> = {
  title: 'Components/ChannelPage/VideoListItem',
  component: VideoListItem,
  args: {
    video,
    checkedBoxes: [],
    selectedForDeletion: [],
    onCheckChange: fn(),
    onToggleDeletion: fn(),
    onToggleIgnore: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof VideoListItem>;

export const Selectable: Story = {
  play: async ({ canvasElement, args }: { canvasElement: HTMLElement; args: any }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Sample Video'));
    await expect(args.onCheckChange).toHaveBeenCalledWith('abc123', true);
  },
};