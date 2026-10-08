import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import AddSubfolderDialog from '../AddSubfolderDialog';

const meta: Meta<typeof AddSubfolderDialog> = {
  title: 'Atomic/Shared/AddSubfolderDialog',
  component: AddSubfolderDialog,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: {
    open: true,
    onClose: fn(),
    onAdd: fn(),
    existingSubfolders: ['__Movies', '__TV Shows'],
  },
};

export default meta;
type Story = StoryObj<typeof AddSubfolderDialog>;

export const EmptyDisabled: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    await expect(body.getByRole('button', { name: /add library folder/i })).toBeDisabled();
  },
};

export const ValidatesAndSubmits: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);

    const input = body.getByLabelText(/library folder name/i);

    // Invalid: reserved prefix
    await userEvent.clear(input);
    await userEvent.type(input, '__Bad');
    await expect(body.getByText(/cannot start with __/i)).toBeInTheDocument();
    await expect(body.getByRole('button', { name: /add library folder/i })).toBeDisabled();

    // Valid
    await userEvent.clear(input);
    await userEvent.type(input, 'Sports');
    await expect(body.getByRole('button', { name: /add library folder/i })).toBeEnabled();

    await userEvent.click(body.getByRole('button', { name: /add library folder/i }));

    await expect(args.onAdd).toHaveBeenCalledWith('Sports');
  },
};
