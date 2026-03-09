import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import ErrorBoundary from '../ErrorBoundary';

const Thrower: React.FC = () => {
  throw new Error('Storybook forced error');
};

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Composite/ErrorBoundary',
  component: ErrorBoundary,
  args: {
    onReset: fn(),
  },
  render: (args) => (
    <ErrorBoundary {...args}>
      <Thrower />
    </ErrorBoundary>
  ),
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

export const ErrorState: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /try again/i }));
    await expect(args.onReset).toHaveBeenCalled();
  },
};
