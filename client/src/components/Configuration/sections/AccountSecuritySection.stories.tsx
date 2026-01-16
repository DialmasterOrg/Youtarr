import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import React from 'react';
import { AccountSecuritySection } from './AccountSecuritySection';

const meta: Meta<typeof AccountSecuritySection> = {
  title: 'Components/Configuration/Sections/AccountSecuritySection',
  component: AccountSecuritySection,
  args: {
    token: 'storybook-token',
    envAuthApplied: false,
    authEnabled: true,
    setSnackbar: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AccountSecuritySection>;

export const ShowsPasswordForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Change Password' }));
    const passwordInputs = canvasElement.querySelectorAll('input[type="password"]');
    await expect(passwordInputs.length).toBeGreaterThanOrEqual(3);

    await userEvent.type(passwordInputs[1], 'password123');
    await userEvent.type(passwordInputs[2], 'password124');
    await expect(await canvas.findByText("Passwords don't match")).toBeInTheDocument();
  },
};
