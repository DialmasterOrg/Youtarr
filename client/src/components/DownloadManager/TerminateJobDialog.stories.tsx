import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import TerminateJobDialog from './TerminateJobDialog';

const meta: Meta<typeof TerminateJobDialog> = {
  title: 'Components/DownloadManager/TerminateJobDialog',
  component: TerminateJobDialog,
  args: {
    open: true,
    onClose: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof TerminateJobDialog>;

export const ConfirmFlow: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Confirm Download Termination')).toBeInTheDocument();

    await userEvent.click(body.getByRole('button', { name: 'Terminate Download' }));
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};
