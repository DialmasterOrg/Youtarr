import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { Root } from './Root';

const meta: Meta<typeof Root> = {
  title: 'Entry/RootComponent',
  component: Root,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/db-status', () => HttpResponse.json({ status: 'healthy' })),
        http.get('/getconfig', () => HttpResponse.json({ preferredResolution: '1080', channelFilesToDownload: 3 })),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Root>;

export const RendersNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const toggleButton = canvas.getByRole('button', { name: /toggle navigation/i });
    await expect(toggleButton).toBeEnabled();
    await userEvent.click(toggleButton);

    const navButtons = canvas.queryAllByRole('button', { name: /channels?|download|video|setting/i });
    await expect(navButtons.length).toBeGreaterThan(0);
  },
};
