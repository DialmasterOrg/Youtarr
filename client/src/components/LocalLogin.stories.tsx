import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import LocalLogin from './LocalLogin';

const meta: Meta<typeof LocalLogin> = {
  title: 'Pages/Auth/LocalLogin',
  component: LocalLogin,
  args: {
    setToken: fn(),
  },
  parameters: {
    msw: {
      handlers: [http.post('/auth/login', () => HttpResponse.json({}, { status: 401 }))],
    },
  },
};

export default meta;
type Story = StoryObj<typeof LocalLogin>;

export const InvalidCredentials: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/username/i), 'admin');
    await userEvent.type(canvas.getByLabelText(/password/i), 'wrongpassword');

    await userEvent.click(canvas.getByRole('button', { name: /login/i }));

    await expect(await canvas.findByText(/invalid username or password/i)).toBeInTheDocument();
  },
};
