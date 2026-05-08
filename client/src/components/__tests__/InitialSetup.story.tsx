import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import InitialSetup from '../InitialSetup';

const meta: Meta<typeof InitialSetup> = {
  title: 'Pages/Auth/InitialSetup',
  component: InitialSetup,
  args: {
    onSetupComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.post('/setup/create-auth', () => HttpResponse.json({ token: 'session-token' })),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof InitialSetup>;

export const PasswordMismatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/setup token/i), 'sample-setup-token');
    await userEvent.type(canvas.getByLabelText(/^password/i), 'password123');
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'password456');

    await userEvent.click(canvas.getByRole('button', { name: /complete setup/i }));

    await expect(await canvas.findByText(/passwords do not match/i)).toBeInTheDocument();
  },
};

export const SuccessfulSetup: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/setup token/i), 'sample-setup-token');
    await userEvent.type(canvas.getByLabelText(/^password/i), 'password123');
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'password123');

    await userEvent.click(canvas.getByRole('button', { name: /complete setup/i }));

    await waitFor(() => expect(args.onSetupComplete).toHaveBeenCalledWith('session-token'));
  },
};
