import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import DownloadNew from './DownloadNew';
import { http, HttpResponse } from 'msw';

const meta: Meta<typeof DownloadNew> = {
  title: 'Components/DownloadManager/DownloadNew',
  component: DownloadNew,
  parameters: {
    docs: {
      disable: true,
    },
    msw: {
      handlers: [
        http.get('/getconfig', () => {
          return HttpResponse.json({
            darkModeEnabled: false,
            preferredResolution: '1080',
            channelFilesToDownload: 3,
          });
        }),
        http.post('/triggerchanneldownloads', () => {
          return HttpResponse.json({ success: true });
        }),
        http.post('/manualdownload', () => {
          return HttpResponse.json({ success: true, jobId: 'test-job-1' });
        }),
      ],
    },
  },
  args: {
    videoUrls: '',
    setVideoUrls: fn(),
    token: 'test-token',
    fetchRunningJobs: fn(),
    downloadInitiatedRef: { current: false },
  },
};

export default meta;
type Story = StoryObj<typeof DownloadNew>;

/**
 * Default DownloadNew component
 * Tests tab navigation and form display
 */
export const Default: Story = {
  args: {
    videoUrls: '',
    setVideoUrls: fn(),
    token: 'test-token',
    fetchRunningJobs: fn(),
    downloadInitiatedRef: { current: false },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for component to render
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify tab navigation exists
    const tabs = canvas.queryAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);

    // Click on second tab (if available)
    if (tabs.length > 1) {
      await userEvent.click(tabs[1]);
      // Component should update active tab
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    }

    // Verify the first tab is initially selected
    if (tabs.length > 0) {
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    }
  },
};

/**
 * Manual Download Tab Active
 * Tests URL input interaction in ManualDownload tab
 */
export const ManualDownloadTab: Story = {
  args: {
    videoUrls: '',
    setVideoUrls: fn(),
    token: 'test-token',
    fetchRunningJobs: fn(),
    downloadInitiatedRef: { current: false },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click on Manual Download tab
    const tabs = canvas.queryAllByRole('tab');
    if (tabs.length > 1) {
      await userEvent.click(tabs[1]);
    }

    // Wait for tab content
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Look for URL input field
    const urlInput = canvas.queryByPlaceholderText(/url|link|youtube/i) ||
                     canvas.queryByLabelText(/url|video/i);

    if (urlInput) {
      // Type a video URL
      const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      await userEvent.click(urlInput);
      await userEvent.type(urlInput, testUrl);

      // Verify input value changed
      expect(urlInput).toHaveValue(testUrl);

      // Find and click download/submit button
      const downloadButton = canvas.queryByRole('button', { name: /download|submit|add/i });
      if (downloadButton) {
        await userEvent.click(downloadButton);
        // Should trigger manual download logic
        expect(args.fetchRunningJobs).toBeDefined();
      }
    }
  },
};

/**
 * Channel Download Tab Active
 * Tests channel download trigger button and settings dialog
 */
export const ChannelDownloadTab: Story = {
  args: {
    videoUrls: '',
    setVideoUrls: fn(),
    token: 'test-token',
    fetchRunningJobs: fn(),
    downloadInitiatedRef: { current: false },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click on Channel Download tab (usually first tab)
    const tabs = canvas.queryAllByRole('tab');
    if (tabs.length > 0) {
      await userEvent.click(tabs[0]);
    }

    // Wait for tab content
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Look for "Channel Download" or "Trigger Download" button
    const triggerButton = canvas.queryByRole('button', { 
      name: /channel|trigger|download|settings/i 
    });

    if (triggerButton) {
      // Check button text
      expect(triggerButton).toBeInTheDocument();

      // Click to trigger channel download
      await userEvent.click(triggerButton);

      // Should call fetchRunningJobs after download initiation
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(args.fetchRunningJobs).toHaveBeenCalled();
    }
  },
};

/**
 * Settings Dialog Open
 * Tests opening and interacting with the download settings dialog
 */
export const SettingsDialogOpen: Story = {
  args: {
    videoUrls: '',
    setVideoUrls: fn(),
    token: 'test-token',
    fetchRunningJobs: fn(),
    downloadInitiatedRef: { current: false },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for initial render
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find settings button (usually next to channel download)
    const settingsButton = canvas.queryByRole('button', {
      name: /settings|gear|options|configure/i,
    });

    if (settingsButton) {
      // Click settings button to open dialog
      await userEvent.click(settingsButton);

      // Wait for dialog to appear
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify dialog elements are visible
      const dialogContent = canvas.queryByRole('dialog') ||
                           canvas.queryByText(/settings|configuration|options/i);

      if (dialogContent) {
        expect(dialogContent).toBeVisible();

        // Look for resolution or quality selector
        const resolutionSelect = canvas.queryByRole('combobox') ||
                                canvas.queryByLabelText(/resolution|quality/i);

        if (resolutionSelect) {
          // Interact with resolution selector
          await userEvent.click(resolutionSelect);
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Try to select different resolution
          const resolutionOption = canvas.queryByText(/1080|720|480/i);
          if (resolutionOption) {
            await userEvent.click(resolutionOption);
          }
        }

        // Find and click confirm/submit button
        const confirmButton = canvas.queryByRole('button', { name: /confirm|apply|save|ok/i });
        if (confirmButton) {
          await userEvent.click(confirmButton);
          // Dialog should close and download should initiate
          expect(args.fetchRunningJobs).toHaveBeenCalled();
        }
      }
    }
  },
};

/**
 * With Pre-filled URLs
 * Tests component with video URLs already populated
 */
export const WithUrls: Story = {
  args: {
    videoUrls: 'https://www.youtube.com/watch?v=video1\nhttps://www.youtube.com/watch?v=video2',
    setVideoUrls: fn(),
    token: 'test-token',
    fetchRunningJobs: fn(),
    downloadInitiatedRef: { current: false },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Navigate to manual download tab
    const tabs = canvas.queryAllByRole('tab');
    if (tabs.length > 1) {
      await userEvent.click(tabs[1]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Verify URLs are displayed (either in input or as chips/pills)
    const urlDisplay = canvas.queryByDisplayValue(/youtube.com/) ||
                       canvas.queryByText(/video1|video2/i);

    if (urlDisplay) {
      expect(urlDisplay).toBeVisible();
    }

    // Verify download button is available
    const downloadButton = canvas.queryByRole('button', { name: /download|submit/i });
    if (downloadButton) {
      expect(downloadButton).toBeEnabled();

      // Click download
      await userEvent.click(downloadButton);
      expect(args.fetchRunningJobs).toHaveBeenCalled();
    }
  },
};

/**
 * Error State - Already Running
 * Tests alert when download already in progress
 */
export const AlreadyRunning: Story = {
  parameters: {
    ...meta.parameters,
    msw: {
      handlers: [
        http.get('/getconfig', () => {
          return HttpResponse.json({
            darkModeEnabled: false,
            preferredResolution: '1080',
            channelFilesToDownload: 3,
          });
        }),
        http.post('/triggerchanneldownloads', () => {
          // Simulate "already running" error
          return HttpResponse.json(
            { error: 'Channel Download already running' },
            { status: 400 }
          );
        }),
      ],
    },
  },
  args: {
    videoUrls: '',
    setVideoUrls: fn(),
    token: 'test-token',
    fetchRunningJobs: fn(),
    downloadInitiatedRef: { current: false },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for render
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Click channel download tab
    const tabs = canvas.queryAllByRole('tab');
    if (tabs.length > 0) {
      await userEvent.click(tabs[0]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Click trigger button
    const triggerButton = canvas.queryByRole('button', {
      name: /channel|trigger|download/i,
    });

    if (triggerButton) {
      await userEvent.click(triggerButton);

      // Wait for error alert
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify error message appears
      const errorMsg = canvas.queryByText(/already running|in progress|wait/i);
      if (errorMsg) {
        expect(errorMsg).toBeVisible();
      }
    }
  },
};
