import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import DateRangeFilterInput from '../DateRangeFilterInput';

const meta: Meta<typeof DateRangeFilterInput> = {
  title: 'Components/ChannelPage/DateRangeFilterInput',
  component: DateRangeFilterInput,
  args: {
    dateFrom: null,
    dateTo: null,
    onFromChange: fn(),
    onToChange: fn(),
    compact: false,
  },
};

export default meta;

type Story = StoryObj<typeof DateRangeFilterInput>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const fromInput = canvas.getByRole('textbox', { name: /filter from date/i });
    const toInput = canvas.getByRole('textbox', { name: /filter to date/i });

    await userEvent.type(fromInput, '01/15/2024');
    await expect(args.onFromChange).toHaveBeenCalled();

    await userEvent.type(toInput, '06/20/2024');
    await expect(args.onToChange).toHaveBeenCalled();
  },
};

export const Compact: Story = {
  args: {
    compact: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('From')).toBeInTheDocument();
    await expect(canvas.getByLabelText('To')).toBeInTheDocument();
  },
};
