import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { AppShell } from './AppShell';

const meta: Meta<typeof AppShell> = {
  title: 'Layout/AppShell',
  component: AppShell,
  args: {
    token: 'storybook-token',
    isPlatformManaged: false,
    appName: 'Youtarr',
    versionLabel: 'v0.0.0-storybook',
    onLogout: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/storage-status', () =>
          HttpResponse.json({
            availableGB: '100',
            totalGB: '200',
            percentFree: 50,
          })
        ),
      ],
    },
  },
  render: (args) => (
    <MemoryRouter>
      <AppShell {...args}>
        <div>Page content</div>
      </AppShell>
    </MemoryRouter>
  ),
};

export default meta;
type Story = StoryObj<typeof AppShell>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Wait for StorageFooterWidget to finish loading
    await expect(await canvas.findByText('100 GB free of 200 GB')).toBeInTheDocument();
  },
};

export const Logout: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Wait for StorageFooterWidget to finish loading to prevent 'act' warning
    await expect(await canvas.findByText('100 GB free of 200 GB')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /logout/i }));
    await expect(args.onLogout).toHaveBeenCalled();
  },
};
