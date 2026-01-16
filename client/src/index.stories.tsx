import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { Root } from './Root';

const meta: Meta<typeof Root> = {
  title: 'Entry/Root',
  component: Root,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/db-status', () => HttpResponse.json({ status: 'healthy' })),
        http.get('/setup/status', () => HttpResponse.json({ requiresSetup: false, isLocalhost: true, platformManaged: false })),
        http.get('/auth/validate', () => HttpResponse.json({ valid: true })),
        http.get('/getconfig', () => HttpResponse.json({ preferredResolution: '1080', channelFilesToDownload: 3 })),
        http.get('/getCurrentReleaseVersion', () => HttpResponse.json({ version: '1.0.0', ytDlpVersion: '2024.01.01' })),
        http.get('/get-running-jobs', () => HttpResponse.json([])),
        http.get('/api/stats', () => HttpResponse.json({ videoCount: 0, downloadCount: 0, storageUsed: 0 })),
      ],
    },
  },
  loaders: [async () => {
    localStorage.setItem('authToken', 'storybook-auth');
    return {};
  }],
};

export default meta;
type Story = StoryObj<typeof Root>;

export const RendersAppShell: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggleButton = await canvas.findByRole('button', { name: /toggle navigation/i });
    await expect(toggleButton).toBeEnabled();
    await userEvent.click(toggleButton);

    localStorage.removeItem('authToken');
  },
};
