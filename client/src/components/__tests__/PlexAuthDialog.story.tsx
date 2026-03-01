import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import PlexAuthDialog from '../PlexAuthDialog';

const meta: Meta<typeof PlexAuthDialog> = {
  title: 'Composite/PlexAuthDialog',
  component: PlexAuthDialog,
  args: {
    open: true,
    onClose: fn(),
    onSuccess: fn(),
    currentApiKey: 'existing-plex-token',
  },
};

export default meta;
type Story = StoryObj<typeof PlexAuthDialog>;

export const Open: Story = {};

export const Cancel: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: /cancel/i }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};
