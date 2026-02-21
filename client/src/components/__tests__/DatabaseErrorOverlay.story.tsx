import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import DatabaseErrorOverlay from '../DatabaseErrorOverlay';

const meta: Meta<typeof DatabaseErrorOverlay> = {
  title: 'Composite/DatabaseErrorOverlay',
  component: DatabaseErrorOverlay,
  args: {
    errors: ['Cannot connect to database'],
    onRetry: fn(),
    recovered: false,
    countdown: 15,
  },
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof DatabaseErrorOverlay>;

export const Default: Story = {};

export const Retry: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('retry-button'));
    await expect(args.onRetry).toHaveBeenCalled();
  },
};
