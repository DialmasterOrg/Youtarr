import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { ThemeEngineProvider } from '../../../contexts/ThemeEngineContext';
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
      <ThemeEngineProvider>
        <CoreSettingsSection
          {...args}
          config={config}
          onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
        />
      </ThemeEngineProvider>
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
    const checkbox = await canvas.findByRole('checkbox', { name: /enable automatic downloads/i });
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();

    const frequencyLabels = await canvas.findAllByText('Download Frequency');
    const frequencyLabel = frequencyLabels.find((label) => label.tagName === 'LABEL') || frequencyLabels[0];
    const frequencySelect = frequencyLabel
      .closest('[class*="MuiFormControl"]')
      ?.querySelector('[role="button"]');
    await expect(frequencySelect as HTMLElement).toBeInTheDocument();
    await expect(frequencySelect as HTMLElement).toBeEnabled();
  },
};

export const ThemeSwitcher: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const playfulCard = await canvas.findByRole('button', { name: /playful geometric theme/i });
    const neumorphicCard = await canvas.findByRole('button', { name: /neumorphic soft ui theme/i });

    await userEvent.click(neumorphicCard);
    await expect(document.body.dataset.theme).toBe('neumorphic');

    await userEvent.click(playfulCard);
    await expect(document.body.dataset.theme).toBe('playful');

    const motionToggle = await canvas.findByRole('checkbox', { name: /enable theme animations & wiggles/i });
    await userEvent.click(motionToggle);
    await expect(document.body.dataset.motion).toBe('off');
  },
};
