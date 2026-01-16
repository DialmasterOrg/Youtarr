import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeEngineProvider } from '../../contexts/ThemeEngineContext';
import { Settings } from './Settings';

const meta: Meta<typeof Settings> = {
  title: 'Pages/Settings',
  component: Settings,
  args: {
    token: 'storybook-token',
  },
  decorators: [
    (Story) => (
      <ThemeEngineProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route path="/settings/*" element={<Story />} />
          </Routes>
        </MemoryRouter>
      </ThemeEngineProvider>
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
    const body = within(canvasElement.ownerDocument.body);

    const headings = await canvas.findAllByRole('heading', { name: /settings/i });
    await expect(headings.length).toBeGreaterThan(0);
    await expect(await body.findByText(/choose a settings area/i)).toBeInTheDocument();

    const coreLink = canvas.getByRole('link', { name: /core/i });
    await userEvent.click(coreLink);
    await expect(await canvas.findByText('Core Settings')).toBeInTheDocument();

    // Wait for other potential background fetches like storage status to prevent 'act' warnings
    await waitFor(() => {
      // Small timeout or just allowing effects to flush
    }, { timeout: 1000 }).catch(() => {});
  },
};
