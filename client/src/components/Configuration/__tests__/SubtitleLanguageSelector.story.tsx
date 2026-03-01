import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import SubtitleLanguageSelector from '../SubtitleLanguageSelector';

const meta: Meta<typeof SubtitleLanguageSelector> = {
  title: 'Components/Configuration/SubtitleLanguageSelector',
  component: SubtitleLanguageSelector,
  args: {
    value: 'en',
    onChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SubtitleLanguageSelector>;

export const MultiSelect: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByLabelText('Subtitle Languages');

    await userEvent.click(select);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByText('Spanish'));

    await expect(args.onChange).toHaveBeenCalled();
    await expect(args.onChange).toHaveBeenCalledWith(expect.stringContaining('es'));
  },
};
