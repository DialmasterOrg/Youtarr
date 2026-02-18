import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import UrlInput from '../UrlInput';

const meta: Meta<typeof UrlInput> = {
  title: 'Components/DownloadManager/UrlInput',
  component: UrlInput,
  args: {
    onValidate: fn(async () => true),
    isValidating: false,
  },
};

export default meta;
type Story = StoryObj<typeof UrlInput>;

export const SubmitWithEnter: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Paste YouTube video URL here...');
    await userEvent.type(input, 'https://youtube.com/watch?v=abc123');
    await userEvent.keyboard('{Enter}');

    await expect(args.onValidate).toHaveBeenCalledWith('https://youtube.com/watch?v=abc123');
  },
};
