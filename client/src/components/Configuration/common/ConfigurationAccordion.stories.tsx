import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Switch, FormControlLabel } from '../../ui';
import { ConfigurationAccordion } from './ConfigurationAccordion';

const meta: Meta<typeof ConfigurationAccordion> = {
  title: 'Configuration/ConfigurationAccordion',
  component: ConfigurationAccordion,
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
type Story = StoryObj<typeof ConfigurationAccordion>;

export const Collapsed: Story = {
  args: {
    title: 'Advanced Settings',
    children: <p className="text-sm text-muted-foreground">Advanced configuration options.</p>,
  },
};

export const DefaultExpanded: Story = {
  args: {
    title: 'General Settings',
    defaultExpanded: true,
    children: <p className="text-sm text-muted-foreground">These settings are expanded by default.</p>,
  },
};

export const WithChip: Story = {
  args: {
    title: 'SponsorBlock',
    chipLabel: 'Beta',
    chipColor: 'warning',
    defaultExpanded: true,
    children: (
      <div className="space-y-3">
        <FormControlLabel
          control={<Switch />}
          label="Enable SponsorBlock"
        />
        <p className="text-xs text-muted-foreground">Automatically skip sponsor segments in videos.</p>
      </div>
    ),
  },
};

export const WithStatusChip: Story = {
  args: {
    title: 'Plex Integration',
    chipLabel: 'Connected',
    chipColor: 'success',
    defaultExpanded: true,
    children: <p className="text-sm text-muted-foreground">Plex server is connected and operational.</p>,
  },
};

export const ConfigurationPanel: Story = {
  render: () => (
    <div>
      <ConfigurationAccordion title="Core Settings" defaultExpanded>
        <p className="text-sm text-muted-foreground">Core download directories and API settings.</p>
      </ConfigurationAccordion>
      <ConfigurationAccordion title="Download Performance">
        <p className="text-sm text-muted-foreground">Concurrent downloads, rate limiting, and retry settings.</p>
      </ConfigurationAccordion>
      <ConfigurationAccordion title="Notifications">
        <p className="text-sm text-muted-foreground">Configure webhook and push notification settings.</p>
      </ConfigurationAccordion>
      <ConfigurationAccordion title="SponsorBlock" chipLabel="Beta" chipColor="warning">
        <p className="text-sm text-muted-foreground">Skip sponsor segments, intros, and outros.</p>
      </ConfigurationAccordion>
    </div>
  ),
};
