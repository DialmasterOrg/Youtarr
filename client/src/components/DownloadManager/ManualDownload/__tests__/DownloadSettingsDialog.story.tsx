import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import DownloadSettingsDialog from '../DownloadSettingsDialog';

const meta: Meta<typeof DownloadSettingsDialog> = {
  title: 'Components/DownloadManager/DownloadSettingsDialog',
  component: DownloadSettingsDialog,
  args: {
    open: true,
    onClose: fn(),
    onConfirm: fn(),
    videoCount: 2,
    missingVideoCount: 0,
    defaultResolution: '1080',
    mode: 'manual',
  },
};

export default meta;
type Story = StoryObj<typeof DownloadSettingsDialog>;

export const ConfirmDefaults: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Download Settings')).toBeInTheDocument();

    await userEvent.click(body.getByRole('button', { name: 'Start Download' }));
    await expect(args.onConfirm).toHaveBeenCalledWith(null);
  },
};

export const CustomSettingsDropdowns: Story = {
  args: {
    mode: 'manual',
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    await userEvent.click(body.getByRole('checkbox', { name: /Use custom settings/i }));

    await userEvent.click(body.getByLabelText('Download Type'));
    await expect(body.getByRole('option', { name: 'Video + MP3' })).toBeInTheDocument();

    await userEvent.click(body.getByRole('option', { name: 'Video + MP3' }));
    await userEvent.click(body.getByLabelText('Content Rating'));
    await expect(body.getByRole('option', { name: /PG-13/ })).toBeInTheDocument();
  },
};
