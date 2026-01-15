import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { PlexIntegrationSection } from './PlexIntegrationSection';
import { PlatformManagedState } from '../types';

const meta: Meta<typeof PlexIntegrationSection> = {
  title: 'Components/Configuration/Sections/PlexIntegrationSection',
  component: PlexIntegrationSection,
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      plexIP: '192.168.1.2',
      plexPort: '32400',
      plexApiKey: 'token',
    });
    return (
      <PlexIntegrationSection
        {...args}
        config={config}
        onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
      />
    );
  },
  args: {
    plexConnectionStatus: 'not_tested',
    hasPlexServerConfigured: true,
    isPlatformManaged: { plexUrl: false, authEnabled: true, useTmpForDownloads: false } as PlatformManagedState,
    onTestConnection: fn(),
    onOpenLibrarySelector: fn(),
    onOpenPlexAuthDialog: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof PlexIntegrationSection>;

export const LaunchGetKey: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /get key/i }));
    await expect(args.onOpenPlexAuthDialog).toHaveBeenCalledTimes(1);
  },
};
