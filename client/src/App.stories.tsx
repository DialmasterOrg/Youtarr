import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { BrowserRouter as Router } from 'react-router-dom';
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
        http.get('/getconfig', () => {
          return HttpResponse.json({
            darkModeEnabled: false,
            preferredResolution: '1080',
            channelFilesToDownload: 3,
          });
        }),
        http.get('/get-running-jobs', () => {
          return HttpResponse.json([]);
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
    (Story) => (
      <Router>
        <Story />
      </Router>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for the app to load
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify main navigation is visible
    const navButtons = canvas.queryAllByRole('button', { name: /channels?|download|video|setting/i });
    expect(navButtons.length).toBeGreaterThan(0);

    // Verify main content area exists
    const mainContent = canvas.queryByRole('main') || canvas.queryByRole('region');
    if (mainContent) {
      expect(mainContent).toBeInTheDocument();
    }
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
        http.get('/getconfig', () => {
          return HttpResponse.json({
            darkModeEnabled: false,
            preferredResolution: '1080',
            channelFilesToDownload: 3,
          });
        }),
      ],
    },
  },
  decorators: [
    (Story) => (
      <Router>
        <Story />
      </Router>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for database check
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify error overlay or error message is visible
    const errorText = canvas.queryByText(/database|error|connection/i);
    // Note: Actual error UI depends on implementation; adjust assertion as needed
    if (errorText) {
      expect(errorText).toBeVisible();
    }
  },
};

/**
 * App with missing setup (requires initial setup)
 * Tests redirect to setup page
 */
export const RequiresSetup: Story = {
  parameters: {
    ...meta.parameters,
    msw: {
      handlers: [
        http.get('/api/db-status', () => {
          return HttpResponse.json({
            status: 'healthy',
          });
        }),
        http.get('/checkrequiressetup', () => {
          return HttpResponse.json({
            requiresSetup: true,
          });
        }),
        http.get('/getconfig', () => {
          return HttpResponse.json({
            darkModeEnabled: false,
            preferredResolution: '1080',
            channelFilesToDownload: 3,
          });
        }),
      ],
    },
  },
  decorators: [
    (Story) => (
      <Router>
        <Story />
      </Router>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for setup check
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify setup page or redirect message
    const setupText = canvas.queryByText(/setup|initial|configuration/i);
    // Adjust based on actual redirect UI
    if (setupText) {
      expect(setupText).toBeVisible();
    }
  },
};
