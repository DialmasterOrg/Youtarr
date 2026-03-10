import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SaveBar } from '../SaveBar';

const meta: Meta<typeof SaveBar> = {
  title: 'Atomic/Configuration/SaveBar',
  component: SaveBar,
  args: {
    hasUnsavedChanges: true,
    isLoading: false,
    validationError: null,
    onSave: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SaveBar>;

export const UnsavedChanges: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /save configuration/i }));
    await expect(args.onSave).toHaveBeenCalled();
  },
};

export const DisabledByValidationError: Story = {
  args: {
    validationError: 'Fix the highlighted fields',
  },
};
