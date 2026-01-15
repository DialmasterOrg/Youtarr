import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import InitialSetup from './InitialSetup';

const meta: Meta<typeof InitialSetup> = {
  title: 'Pages/Auth/InitialSetup',
  component: InitialSetup,
  args: {
    onSetupComplete: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/setup/status', () =>
          HttpResponse.json({ requiresSetup: true, isLocalhost: true })
        ),
        http.post('/setup/create-auth', () => HttpResponse.json({ token: 'setup-token' })),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof InitialSetup>;

export const PasswordMismatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const completeSetup = await canvas.findByRole('button', { name: /complete setup/i });
    await waitFor(() => expect(completeSetup).toBeEnabled());

    await userEvent.type(canvas.getByLabelText(/^password/i), 'password123');
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'password456');

    await userEvent.click(completeSetup);

    await expect(await canvas.findByText(/passwords do not match/i)).toBeInTheDocument();
  },
};

export const SuccessfulSetup: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const completeSetup = await canvas.findByRole('button', { name: /complete setup/i });
    await waitFor(() => expect(completeSetup).toBeEnabled());

    const password = canvas.getByLabelText(/^password/i);
    const confirmPassword = canvas.getByLabelText(/confirm password/i);

    await userEvent.clear(password);
    await userEvent.type(password, 'password123');
    await userEvent.clear(confirmPassword);
    await userEvent.type(confirmPassword, 'password123');

    await userEvent.click(completeSetup);

    await waitFor(() => expect(args.onSetupComplete).toHaveBeenCalledWith('setup-token'));
  },
};
