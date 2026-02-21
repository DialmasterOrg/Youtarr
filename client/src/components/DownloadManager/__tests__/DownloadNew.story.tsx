import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import DownloadNew from '../DownloadNew';
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
        http.get('/api/channels/subfolders', () => {
          return HttpResponse.json(['Movies', 'Shows']);
        }),
        http.post('/triggerspecificdownloads', () => {
          return HttpResponse.json({ success: true, jobId: 'test-job-1' });
        }),
        http.post('/api/checkYoutubeVideoURL', async ({ request }) => {
          const body = (await request.json()) as { url?: string };
          const url = body.url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
          const youtubeId = url.includes('video2') ? 'video2' : 'video1';
          return HttpResponse.json({
            isValidUrl: true,
            isAlreadyDownloaded: false,
            isMembersOnly: false,
            metadata: {
              youtubeId,
              url,
              channelName: 'Storybook Channel',
              videoTitle: youtubeId === 'video2' ? 'Second Story Video' : 'First Story Video',
              duration: 213,
              publishedAt: Date.now(),
              media_type: 'video',
            },
          });
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

    const manualTab = await canvas.findByRole('tab', { name: /manual download/i });
    const channelTab = await canvas.findByRole('tab', { name: /channel download/i });

    await expect(manualTab).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(channelTab);
    await expect(channelTab).toHaveAttribute('aria-selected', 'true');
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
    const body = within(canvasElement.ownerDocument.body);

    const urlInput = await canvas.findByPlaceholderText(/paste youtube video url here/i);
    await userEvent.type(urlInput, 'https://www.youtube.com/watch?v=video1{enter}');

    await expect(await canvas.findByText(/first story video/i)).toBeInTheDocument();

    const downloadButton = await canvas.findByRole('button', { name: /download videos/i });
    await userEvent.click(downloadButton);

    await expect(await body.findByRole('dialog', { name: /download settings/i })).toBeInTheDocument();
    const startButton = await body.findByRole('button', { name: /start download/i });
    await userEvent.click(startButton);

    await waitFor(async () => {
      await expect(args.fetchRunningJobs).toHaveBeenCalled();
    }, { timeout: 2000 });
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
    const body = within(canvasElement.ownerDocument.body);

    const channelTab = await canvas.findByRole('tab', { name: /channel download/i });
    await userEvent.click(channelTab);

    const triggerButton = await canvas.findByRole('button', { name: /download new from all channels/i });
    await userEvent.click(triggerButton);

    await expect(await body.findByRole('dialog', { name: /download settings/i })).toBeInTheDocument();
    const startButton = await body.findByRole('button', { name: /start download/i });
    await userEvent.click(startButton);

    await waitFor(async () => {
      await expect(args.fetchRunningJobs).toHaveBeenCalled();
    }, { timeout: 2000 });
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
    const body = within(canvasElement.ownerDocument.body);

    const urlInput = await canvas.findByPlaceholderText(/paste youtube video url here/i);
    await userEvent.type(urlInput, 'https://www.youtube.com/watch?v=video1{enter}');
    await expect(await canvas.findByText(/first story video/i)).toBeInTheDocument();

    const downloadButton = await canvas.findByRole('button', { name: /download videos/i });
    await userEvent.click(downloadButton);

    await expect(await body.findByRole('dialog', { name: /download settings/i })).toBeInTheDocument();
    const customToggle = await body.findByLabelText(/use custom settings/i);
    await userEvent.click(customToggle);

    const resolutionSelect = await body.findByLabelText(/maximum resolution/i);
    await userEvent.click(resolutionSelect);
    const resolutionOption = await body.findByRole('option', { name: /720p/i });
    await userEvent.click(resolutionOption);

    const startButton = await body.findByRole('button', { name: /start download/i });
    await userEvent.click(startButton);

    await waitFor(async () => {
      await expect(args.fetchRunningJobs).toHaveBeenCalled();
    }, { timeout: 2000 });
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
    const body = within(canvasElement.ownerDocument.body);

    const urlInput = await canvas.findByPlaceholderText(/paste youtube video url here/i);
    await userEvent.type(urlInput, 'https://www.youtube.com/watch?v=video1{enter}');
    await expect(await canvas.findByText(/first story video/i)).toBeInTheDocument();

    await userEvent.type(urlInput, 'https://www.youtube.com/watch?v=video2{enter}');
    await expect(await canvas.findByText(/second story video/i)).toBeInTheDocument();

    const downloadButton = await canvas.findByRole('button', { name: /download videos/i });
    await userEvent.click(downloadButton);
    const startButton = await body.findByRole('button', { name: /start download/i });
    await userEvent.click(startButton);

    await waitFor(async () => {
      await expect(args.fetchRunningJobs).toHaveBeenCalled();
    }, { timeout: 2000 });
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
    const body = within(canvasElement.ownerDocument.body);
    const originalAlert = window.alert;
    const alertSpy = fn();
    window.alert = alertSpy;

    const channelTab = await canvas.findByRole('tab', { name: /channel download/i });
    await userEvent.click(channelTab);

    const triggerButton = await canvas.findByRole('button', { name: /download new from all channels/i });
    await userEvent.click(triggerButton);

    await expect(await body.findByRole('dialog', { name: /download settings/i })).toBeInTheDocument();
    const startButton = await body.findByRole('button', { name: /start download/i });
    await userEvent.click(startButton);

    await waitFor(async () => {
      await expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/already running/i));
    }, { timeout: 2000 });

    window.alert = originalAlert;
  },
};
