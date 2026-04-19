import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TextField } from '../../ui';
import { ConfigurationCard } from './ConfigurationCard';

const meta: Meta<typeof ConfigurationCard> = {
  title: 'Configuration/ConfigurationCard',
  component: ConfigurationCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl mx-auto">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ConfigurationCard>;

export const Basic: Story = {
  args: {
    title: 'Download Settings',
    children: <p className="text-sm text-muted-foreground">Configure how downloads are handled.</p>,
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'Storage Configuration',
    subtitle: 'Set the base download directory and folder structure preferences.',
    children: (
      <div className="space-y-4 mt-2">
        <TextField label="Download Directory" defaultValue="/downloads" fullWidth size="small" />
        <TextField label="Subfolder Template" defaultValue="{uploader}" fullWidth size="small" />
      </div>
    ),
  },
};

export const WithFormContent: Story = {
  render: () => (
    <ConfigurationCard title="Plex Integration" subtitle="Connect to your Plex Media Server to auto-refresh libraries after downloads.">
      <div className="space-y-4 mt-2">
        <TextField label="Plex Server URL" fullWidth size="small" placeholder="http://192.168.1.100:32400" />
        <TextField label="Plex Token" fullWidth size="small" type="password" />
      </div>
    </ConfigurationCard>
  ),
};

export const MultipleCards: Story = {
  render: () => (
    <div className="space-y-0">
      <ConfigurationCard title="General" subtitle="Core application settings.">
        <p className="text-sm text-muted-foreground mt-1">General settings content.</p>
      </ConfigurationCard>
      <ConfigurationCard title="Downloads" subtitle="Download quality and format preferences.">
        <p className="text-sm text-muted-foreground mt-1">Download settings content.</p>
      </ConfigurationCard>
      <ConfigurationCard title="Notifications" subtitle="Configure push notifications and alerts.">
        <p className="text-sm text-muted-foreground mt-1">Notification settings content.</p>
      </ConfigurationCard>
    </div>
  ),
};
