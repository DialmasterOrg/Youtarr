import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import DownloadHistory from './DownloadHistory';
import { Job } from '../../types/Job';

const jobs: Job[] = [
  {
    id: 'job-1',
    jobType: 'Channel Downloads',
    status: 'In Progress',
    output: 'Downloading',
    timeCreated: Date.now() - 1000 * 60 * 5,
    timeInitiated: Date.now() - 1000 * 60 * 4,
    data: { videos: [] },
  },
];

const meta: Meta<typeof DownloadHistory> = {
  title: 'Components/DownloadManager/DownloadHistory',
  component: DownloadHistory,
  args: {
    jobs,
    currentTime: new Date(),
    expanded: {},
    anchorEl: {},
    handleExpandCell: () => {},
    setAnchorEl: () => {},
    isMobile: false,
  },
};

export default meta;
type Story = StoryObj<typeof DownloadHistory>;

export const ToggleShowNoVideos: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: 'Show jobs with no videos' });
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};
