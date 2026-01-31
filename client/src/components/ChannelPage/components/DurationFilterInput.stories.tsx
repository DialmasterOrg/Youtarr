import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import DurationFilterInput from './DurationFilterInput';

const meta: Meta<typeof DurationFilterInput> = {
  title: 'Components/ChannelPage/DurationFilterInput',
  component: DurationFilterInput,
  args: {
    minDuration: null,
    maxDuration: null,
    onMinChange: fn(),
    onMaxChange: fn(),
    compact: false,
  },
};

export default meta;

type Story = StoryObj<typeof DurationFilterInput>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const minInput = canvas.getByRole('spinbutton', { name: /minimum duration/i });
    const maxInput = canvas.getByRole('spinbutton', { name: /maximum duration/i });

    await userEvent.type(minInput, '5');
    await expect(args.onMinChange).toHaveBeenCalledWith(5);

    await userEvent.type(maxInput, '9');
    await expect(args.onMaxChange).toHaveBeenCalledWith(9);
  },
};

export const Compact: Story = {
  args: {
    compact: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Duration:')).not.toBeInTheDocument();
  },
};
