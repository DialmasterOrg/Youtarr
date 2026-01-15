import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import ChannelVideosHeader from './ChannelVideosHeader';
import { ChannelVideo } from '../../types/ChannelVideo';

const paginatedVideos: ChannelVideo[] = [
  {
    title: 'First Video',
    youtube_id: 'vid1',
    publishedAt: '2024-01-01T00:00:00Z',
    thumbnail: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg',
    added: false,
    removed: false,
    duration: 120,
    media_type: 'video',
  },
];

const meta: Meta<typeof ChannelVideosHeader> = {
  title: 'Components/ChannelPage/ChannelVideosHeader',
  component: ChannelVideosHeader,
  args: {
    isMobile: false,
    viewMode: 'grid',
    searchQuery: '',
    hideDownloaded: false,
    totalCount: 1,
    oldestVideoDate: '2024-01-01T00:00:00Z',
    fetchingAllVideos: false,
    checkedBoxes: ['vid1'],
    selectedForDeletion: [],
    deleteLoading: false,
    paginatedVideos,
    autoDownloadsEnabled: true,
    selectedTab: 'videos',
    onViewModeChange: fn(),
    onSearchChange: fn(),
    onHideDownloadedChange: fn(),
    onAutoDownloadChange: fn(),
    onRefreshClick: fn(),
    onDownloadClick: fn(),
    onSelectAll: fn(),
    onClearSelection: fn(),
    onDeleteClick: fn(),
    onBulkIgnoreClick: fn(),
    onInfoIconClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ChannelVideosHeader>;

export const DownloadSelection: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /download 1 video/i }));
    await expect(args.onDownloadClick).toHaveBeenCalledTimes(1);
  },
};
