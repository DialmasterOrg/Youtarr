import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from './alert';

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    severity: { control: 'select', options: ['error', 'warning', 'info', 'success'] },
    variant: { control: 'select', options: ['standard', 'outlined', 'filled'] },
  },
  args: { severity: 'info', children: 'This is an alert message.' },
};

export default meta;
type Story = StoryObj<typeof Alert>;

// ─── Severities ─────────────────────────────────────────────────────────────
export const AllSeverities: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      <Alert severity="error">Something went wrong. Please try again.</Alert>
      <Alert severity="warning">Your storage is almost full.</Alert>
      <Alert severity="info">A new version of yt-dlp is available.</Alert>
      <Alert severity="success">Download completed successfully!</Alert>
    </div>
  ),
};

export const Error: Story = { args: { severity: 'error', children: 'Connection to Plex failed.' } };
export const Warning: Story = { args: { severity: 'warning', children: 'Storage usage at 85%.' } };
export const Info: Story = { args: { severity: 'info', children: 'Fetching channel data in the background.' } };
export const Success: Story = { args: { severity: 'success', children: 'All channels synced successfully.' } };

// ─── Variants ────────────────────────────────────────────────────────────────
export const Standard: Story = { args: { variant: 'standard', severity: 'info', children: 'Standard alert.' } };
export const Outlined: Story = { args: { variant: 'outlined', severity: 'info', children: 'Outlined alert.' } };
export const Filled: Story = { args: { variant: 'filled', severity: 'info', children: 'Filled alert.' } };

export const FilledSeverities: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      <Alert severity="error" variant="filled">Error – filled.</Alert>
      <Alert severity="warning" variant="filled">Warning – filled.</Alert>
      <Alert severity="info" variant="filled">Info – filled.</Alert>
      <Alert severity="success" variant="filled">Success – filled.</Alert>
    </div>
  ),
};

// ─── With Close ──────────────────────────────────────────────────────────────
export const Closeable: Story = {
  args: { severity: 'info', onClose: () => {}, children: 'Dismiss this alert.' },
};

// ─── With Action ─────────────────────────────────────────────────────────────
export const WithAction: Story = {
  render: () => (
    <Alert
      severity="warning"
      action={<button className="text-xs font-bold underline">Upgrade</button>}
    >
      Your plan is limited to 10 channels.
    </Alert>
  ),
};

// ─── No Icon ─────────────────────────────────────────────────────────────────
export const NoIcon: Story = {
  args: { severity: 'info', icon: false, children: 'Alert without an icon.' },
};
