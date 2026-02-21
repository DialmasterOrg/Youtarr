import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import AutoDownloadChips from '../AutoDownloadChips';

const meta: Meta<typeof AutoDownloadChips> = {
  title: 'Atomic/ChannelManager/Chips/AutoDownloadChips',
  component: AutoDownloadChips,
  args: {
    availableTabs: 'videos,shorts,streams',
    autoDownloadTabs: 'video,livestream',
    isMobile: false,
  },
};

export default meta;
type Story = StoryObj<typeof AutoDownloadChips>;

export const Mixed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId('auto-download-chip-videos')).toHaveAttribute('data-autodownload', 'true');
    await expect(canvas.getByTestId('auto-download-chip-streams')).toHaveAttribute('data-autodownload', 'true');
    await expect(canvas.getByTestId('auto-download-chip-shorts')).toHaveAttribute('data-autodownload', 'false');
  },
};
