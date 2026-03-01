import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import HelpDialog from '../ChannelManager/HelpDialog';

const meta: Meta<typeof HelpDialog> = {
  title: 'Components/ChannelManager/HelpDialog',
  component: HelpDialog,
  args: {
    open: true,
    onClose: fn(),
    isMobile: false,
  },
};

export default meta;
type Story = StoryObj<typeof HelpDialog>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Channel Display Guide')).toBeInTheDocument();

    await userEvent.click(body.getByRole('button', { name: 'Close' }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};
