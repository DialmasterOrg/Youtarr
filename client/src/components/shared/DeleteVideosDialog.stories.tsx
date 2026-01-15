import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import DeleteVideosDialog from './DeleteVideosDialog';

const meta: Meta<typeof DeleteVideosDialog> = {
  title: 'Atomic/Shared/DeleteVideosDialog',
  component: DeleteVideosDialog,
  args: {
    open: true,
    videoCount: 3,
    onClose: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DeleteVideosDialog>;

export const ConfirmDeletion: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);

    await expect(body.getByText(/confirm video deletion/i)).toBeInTheDocument();
    await userEvent.click(body.getByRole('button', { name: /delete videos/i }));

    await expect(args.onConfirm).toHaveBeenCalled();
  },
};
