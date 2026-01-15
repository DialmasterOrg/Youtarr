import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { SubfolderAutocomplete } from './SubfolderAutocomplete';

const meta: Meta<typeof SubfolderAutocomplete> = {
  title: 'Atomic/Shared/SubfolderAutocomplete',
  component: SubfolderAutocomplete,
  args: {
    value: null,
    onChange: fn(),
    subfolders: ['__Movies', '__TV Shows', '__Documentaries'],
    defaultSubfolderDisplay: 'Movies',
    mode: 'channel',
    disabled: false,
    loading: false,
    helperText: 'Choose a subfolder',
  },
};

export default meta;
type Story = StoryObj<typeof SubfolderAutocomplete>;

export const ChannelMode: Story = {};

export const SelectExistingSubfolder: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    // Open the autocomplete popup
    await userEvent.click(canvas.getByRole('combobox'));

    // Select an existing option (displayed with __ prefix)
    await userEvent.click(await body.findByText('__TV Shows'));

    // onChange is called with the clean value (no __ prefix)
    await expect(args.onChange).toHaveBeenCalledWith('TV Shows');
  },
};
