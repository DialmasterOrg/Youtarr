import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Music } from 'lucide-react';
import { Chip } from './chip';

const meta: Meta<typeof Chip> = {
  title: 'UI/Chip',
  component: Chip,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'select', options: ['filled', 'outlined'] },
    color: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'error', 'warning', 'success', 'info'],
    },
    size: { control: 'select', options: ['small', 'medium'] },
  },
  args: { label: 'Chip', variant: 'filled', color: 'default', size: 'medium' },
};

export default meta;
type Story = StoryObj<typeof Chip>;

// ─── Variants ────────────────────────────────────────────────────────────────
export const Filled: Story = { args: { variant: 'filled', label: 'Filled' } };
export const Outlined: Story = { args: { variant: 'outlined', label: 'Outlined' } };

// ─── Colors ──────────────────────────────────────────────────────────────────
export const Colors: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['default', 'primary', 'secondary', 'error', 'warning', 'success', 'info'] as const).map((c) => (
        <Chip key={c} label={c} color={c} />
      ))}
    </div>
  ),
};

export const OutlinedColors: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['default', 'primary', 'secondary', 'error', 'warning', 'success', 'info'] as const).map((c) => (
        <Chip key={c} label={c} color={c} variant="outlined" />
      ))}
    </div>
  ),
};

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Chip label="Small" size="small" color="primary" />
      <Chip label="Medium" size="medium" color="primary" />
    </div>
  ),
};

// ─── Deletable ────────────────────────────────────────────────────────────────
export const Deletable: Story = {
  args: { label: 'Deletable', onDelete: () => alert('deleted'), color: 'primary' },
};

export const DeletableOutlined: Story = {
  args: { label: 'Deletable', onDelete: () => {}, color: 'secondary', variant: 'outlined' },
};

// ─── Clickable ────────────────────────────────────────────────────────────────
export const Clickable: Story = {
  args: { label: 'Click me', onClick: () => {}, color: 'info' },
};

// ─── With Icon ────────────────────────────────────────────────────────────────
export const WithIcon: Story = {
  args: { label: 'Music', icon: <Music className="h-3 w-3" />, color: 'secondary' },
};

// ─── Download Format Group ────────────────────────────────────────────────────
export const QualityChips: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Chip label="4K" size="small" color="success" />
      <Chip label="1080p" size="small" color="primary" />
      <Chip label="720p" size="small" color="info" />
      <Chip label="480p" size="small" color="default" />
      <Chip label="Audio Only" size="small" color="secondary" />
    </div>
  ),
};
