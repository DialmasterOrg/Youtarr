import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Settings } from './Settings';

const meta: Meta<typeof Settings> = {
  title: 'Pages/Settings',
  component: Settings,
  args: {
    token: 'storybook-token',
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/settings']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/getconfig', () =>
          HttpResponse.json({
            preferredResolution: '1080',
            channelFilesToDownload: 3,
            darkModeEnabled: false,
            isPlatformManaged: { plexUrl: false, authEnabled: true, useTmpForDownloads: false },
            deploymentEnvironment: { platform: null, isWsl: false },
          })
        ),
        http.get('/storage-status', () =>
          HttpResponse.json({ availableGB: '100', totalGB: '200', percentFree: 50 })
        ),
        http.get('/api/channels/subfolders', () =>
          HttpResponse.json(['Movies', 'Shows'])
        ),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Settings>;

export const IndexPage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Settings')).toBeInTheDocument();
    await expect(await canvas.findByText('Choose a settings area.')).toBeInTheDocument();

    const coreLink = canvas.getByRole('link', { name: /core/i });
    await userEvent.click(coreLink);
    await expect(await canvas.findByText('Core Settings')).toBeInTheDocument();
  },
};
