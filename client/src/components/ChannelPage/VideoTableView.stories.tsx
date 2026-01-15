import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import VideoTableView from './VideoTableView';
import { ChannelVideo } from '../../types/ChannelVideo';

const videos: ChannelVideo[] = [
  {
    title: 'First Video',
    youtube_id: 'vid1',
    publishedAt: '2024-01-01T00:00:00Z',
    thumbnail: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg',
    added: false,
    removed: false,
    duration: 120,
    fileSize: 1024 * 1024,
    media_type: 'video',
    ignored: false,
  },
];

const meta: Meta<typeof VideoTableView> = {
  title: 'Components/ChannelPage/VideoTableView',
  component: VideoTableView,
  args: {
    videos,
    checkedBoxes: [],
    selectedForDeletion: [],
    sortBy: 'date',
    sortOrder: 'desc',
    onCheckChange: fn(),
    onSelectAll: fn(),
    onClearSelection: fn(),
    onSortChange: fn(),
    onToggleDeletion: fn(),
    onToggleIgnore: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof VideoTableView>;

export const ToggleSelection: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getAllByRole('checkbox')[0];
    await userEvent.click(checkbox);
    await expect(args.onCheckChange).toHaveBeenCalledWith('vid1', true);
  },
};
