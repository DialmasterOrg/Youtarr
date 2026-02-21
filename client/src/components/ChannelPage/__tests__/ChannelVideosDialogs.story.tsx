import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import ChannelVideosDialogs from '../ChannelVideosDialogs';

const meta: Meta<typeof ChannelVideosDialogs> = {
  title: 'Components/ChannelPage/ChannelVideosDialogs',
  component: ChannelVideosDialogs,
  args: {
    token: 'storybook-token',
    downloadDialogOpen: true,
    refreshConfirmOpen: false,
    deleteDialogOpen: false,
    fetchAllError: null,
    mobileTooltip: null,
    successMessage: null,
    errorMessage: null,
    videoCount: 2,
    missingVideoCount: 0,
    selectedForDeletion: 0,
    defaultResolution: '1080',
    defaultResolutionSource: 'global',
    selectedTab: 'videos',
    tabLabel: 'Videos',
    onDownloadDialogClose: fn(),
    onDownloadConfirm: fn(),
    onRefreshCancel: fn(),
    onRefreshConfirm: fn(),
    onDeleteCancel: fn(),
    onDeleteConfirm: fn(),
    onFetchAllErrorClose: fn(),
    onMobileTooltipClose: fn(),
    onSuccessMessageClose: fn(),
    onErrorMessageClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ChannelVideosDialogs>;

export const DownloadDialog: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: 'Start Download' }));
    await expect(args.onDownloadConfirm).toHaveBeenCalledWith(null);
  },
};
