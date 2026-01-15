import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { CoreSettingsSection } from './CoreSettingsSection';

const meta: Meta<typeof CoreSettingsSection> = {
  title: 'Components/Configuration/Sections/CoreSettingsSection',
  component: CoreSettingsSection,
  parameters: {
    msw: {
      handlers: [
        http.get('/api/channels/subfolders', () =>
          HttpResponse.json(['Movies', 'Shows'])
        ),
      ],
    },
  },
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      youtubeOutputDirectory: '/downloads/youtube',
      channelAutoDownload: false,
      channelDownloadFrequency: '0 0 * * *',
      channelFilesToDownload: 3,
      preferredResolution: '1080',
      videoCodec: 'default',
      defaultSubfolder: '',
    });
    return (
      <CoreSettingsSection
        {...args}
        config={config}
        onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
      />
    );
  },
  args: {
    token: 'storybook-token',
    deploymentEnvironment: { platform: null, isWsl: false },
    isPlatformManaged: { plexUrl: false, authEnabled: true, useTmpForDownloads: false },
    onMobileTooltipClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CoreSettingsSection>;

export const ToggleAutoDownloads: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole('checkbox', { name: /enable automatic downloads/i });
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};
