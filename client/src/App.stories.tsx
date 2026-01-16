import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import App from './App';
import { http, HttpResponse } from 'msw';

/**
 * App Component Story
 * 
 * Tests the main application routing, navigation, and error handling.
 * Note: Fetch override is disabled in test mode (import.meta.env.MODE === 'test'),
 * so database error detection via fetch interception is not tested here.
 * Integration tests should cover that flow separately.
 */

const meta: Meta<typeof App> = {
  title: 'Pages/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
    docs: {
      disable: true,
    },
    msw: {
      handlers: [
        // Mock required endpoints
        http.get('/api/db-status', () => {
          return HttpResponse.json({
            status: 'healthy',
          });
        }),
        http.get('/setup/status', () => {
          return HttpResponse.json({
            requiresSetup: false,
            isLocalhost: true,
            platformManaged: false,
          });
        }),
        http.get('/auth/validate', () => {
          return HttpResponse.json({ valid: true });
        }),
        http.get('/getconfig', () => {
          return HttpResponse.json({
            darkModeEnabled: false,
            preferredResolution: '1080',
            channelFilesToDownload: 3,
          });
        }),
        http.get('/api/channels/subfolders', () => {
          return HttpResponse.json(['Default']);
        }),
        http.get('/get-running-jobs', () => {
          return HttpResponse.json([]);
        }),
        http.get('/getCurrentReleaseVersion', () => {
          return HttpResponse.json({
            version: '1.0.0',
            ytDlpVersion: '2024.01.01',
          });
        }),
        http.get('/api/stats', () => {
          return HttpResponse.json({
            videoCount: 150,
            downloadCount: 45,
            storageUsed: 5368709120, // 5GB
          });
        }),
      ],
    },
  },
  args: {},
};

export default meta;
type Story = StoryObj<typeof App>;

/**
 * Default App render with logged-in user and healthy database
 * Tests navigation menu availability and route rendering
 */
export const LoggedIn: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem('authToken', 'storybook-auth');
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify navigation toggle is actionable
    const toggleButton = await canvas.findByRole('button', { name: /toggle navigation/i });
    await expect(toggleButton).toBeEnabled();
    await userEvent.click(toggleButton);

    // Verify main content area exists
    const mainContent = canvas.queryByRole('main') || canvas.queryByRole('region');
    if (mainContent) {
      await expect(mainContent).toBeInTheDocument();
    }

    localStorage.removeItem('authToken');
  },
};

/**
 * App with database error state
 * Tests error overlay and recovery UI
 */
export const DatabaseError: Story = {
  parameters: {
    ...meta.parameters,
    msw: {
      handlers: [
        http.get('/api/db-status', () => {
          return HttpResponse.json(
            {
              status: 'error',
              database: {
                errors: [
                  'Connection refused to database',
                  'Check server logs for details',
                ],
              },
            },
            { status: 503 }
          );
        }),
        http.get('/setup/status', () => {
          return HttpResponse.json({
            requiresSetup: false,
            isLocalhost: true,
            platformManaged: false,
          });
        }),
        http.get('/getconfig', () => {
          return HttpResponse.json({
            darkModeEnabled: false,
            preferredResolution: '1080',
            channelFilesToDownload: 3,
          });
        }),
        http.get('/api/channels/subfolders', () => {
          return HttpResponse.json(['Default']);
        }),
        http.get('/getCurrentReleaseVersion', () => {
          return HttpResponse.json({
            version: '1.0.0',
            ytDlpVersion: '2024.01.01',
          });
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    const overlay = await body.findByTestId('database-error-overlay');
    await expect(overlay).toBeVisible();
    await expect(await body.findByText(/database issue detected/i)).toBeInTheDocument();
  },
};

/**
 * App with missing setup (requires initial setup)
 * Tests redirect to setup page
 */
export const RequiresSetup: Story = {
  decorators: [
    (Story) => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('plexAuthToken');
      window.history.replaceState({}, '', '/setup');
      return <Story />;
    },
  ],
  parameters: {
    ...meta.parameters,
    msw: {
      handlers: [
        http.get('/api/db-status', () => {
          return HttpResponse.json({
            status: 'healthy',
          });
        }),
        http.get('/setup/status', () => {
          return HttpResponse.json({
            requiresSetup: true,
            isLocalhost: true,
            platformManaged: false,
          });
        }),
        http.get('/getconfig', () => {
          return HttpResponse.json({
            darkModeEnabled: false,
            preferredResolution: '1080',
            channelFilesToDownload: 3,
          });
        }),
        http.get('/api/channels/subfolders', () => {
          return HttpResponse.json(['Default']);
        }),
        http.get('/getCurrentReleaseVersion', () => {
          return HttpResponse.json({
            version: '1.0.0',
            ytDlpVersion: '2024.01.01',
          });
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    await expect(await body.findByText(/welcome to youtarr setup/i)).toBeInTheDocument();
    await expect(await body.findByRole('button', { name: /complete setup/i })).toBeInTheDocument();
  },
};
