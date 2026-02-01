import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { ThemeEngineProvider } from '../../../contexts/ThemeEngineContext';
import { DownloadingSection } from './DownloadingSection';

const meta: Meta<typeof DownloadingSection> = {
  title: 'Components/Configuration/Sections/DownloadingSection',
  component: DownloadingSection,
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      enableStallDetection: true,
      enableStallRetries: true,
      enforceRateLimit: false,
      useProxy: false,
    });

    return (
      <ThemeEngineProvider>
        <DownloadingSection
          {...args}
          config={config}
          onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
        />
      </ThemeEngineProvider>
    );
  },
};

export default meta;

type Story = StoryObj<typeof DownloadingSection>;

export const Default: Story = {
  args: {
    ytDlpVersionInfo: {
      currentVersion: '2024.10.07',
      latestVersion: '2024.10.07',
      updateAvailable: false,
    },
    ytDlpUpdateStatus: 'idle',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/yt-dlp/i)).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
  },
};

export const UpdateAvailable: Story = {
  args: {
    ytDlpVersionInfo: {
      currentVersion: '2024.10.07',
      latestVersion: '2025.01.01',
      updateAvailable: true,
    },
    ytDlpUpdateStatus: 'idle',
    onYtDlpUpdate: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const updateButton = await canvas.findByRole('button', { name: /update/i });
    await userEvent.click(updateButton);
    await expect(await body.findByText(/Update yt-dlp\?/i)).toBeInTheDocument();
  },
};
