import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { TopSaveBar } from './TopSaveBar';

const meta: Meta<typeof TopSaveBar> = {
  title: 'Atomic/Configuration/TopSaveBar',
  component: TopSaveBar,
  args: {
    hasUnsavedChanges: true,
    isLoading: false,
    validationError: null,
    onSave: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof TopSaveBar>;

export const UnsavedChanges: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /save now/i }));
    await expect(args.onSave).toHaveBeenCalled();
  },
};

export const ValidationError: Story = {
  args: {
    validationError: 'Invalid configuration',
  },
};

export const Saving: Story = {
  args: {
    isLoading: true,
  },
};
