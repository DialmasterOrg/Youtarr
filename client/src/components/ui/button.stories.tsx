import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['contained', 'outlined', 'text', 'secondary', 'ghost', 'destructive', 'outlined-destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon', 'icon-sm'],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'error', 'warning', 'info', 'success'],
    },
  },
  args: {
    children: 'Button',
    variant: 'contained',
    size: 'md',
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ─── Variants ────────────────────────────────────────────────────────────────
export const Contained: Story = { args: { variant: 'contained', children: 'Contained' } };
export const Outlined: Story = { args: { variant: 'outlined', children: 'Outlined' } };
export const Text: Story = { args: { variant: 'text', children: 'Text' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Secondary' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Ghost' } };
export const Destructive: Story = { args: { variant: 'destructive', children: 'Delete' } };
export const OutlinedDestructive: Story = { args: { variant: 'outlined-destructive', children: 'Delete' } };
export const Link: Story = { args: { variant: 'link', children: 'Click here' } };

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button variant="contained" size="sm">Small</Button>
      <Button variant="contained" size="md">Medium</Button>
      <Button variant="contained" size="lg">Large</Button>
    </div>
  ),
};

// ─── With Icons ───────────────────────────────────────────────────────────────
export const WithStartIcon: Story = {
  args: { variant: 'contained', startIcon: <Plus className="h-4 w-4" />, children: 'Add Channel' },
};

export const WithEndIcon: Story = {
  args: { variant: 'outlined', endIcon: <Download className="h-4 w-4" />, children: 'Download' },
};

export const IconButton: Story = {
  args: { variant: 'ghost', size: 'icon', children: <Trash2 className="h-4 w-4" /> },
};

// ─── States ──────────────────────────────────────────────────────────────────
export const Disabled: Story = { args: { variant: 'contained', disabled: true, children: 'Disabled' } };

export const Loading: Story = { args: { variant: 'contained', loading: true, children: 'Saving…' } };

export const FullWidth: Story = {
  args: { variant: 'contained', fullWidth: true, children: 'Full Width' },
  decorators: [(Story) => <div className="w-64"><Story /></div>],
};

// ─── All Variants Grid ────────────────────────────────────────────────────────
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['contained', 'outlined', 'text', 'secondary', 'ghost', 'destructive'] as const).map((v) => (
        <div key={v} className="flex items-center gap-3">
          <Button variant={v}>{v}</Button>
          <Button variant={v} disabled>{v} disabled</Button>
          <Button variant={v} size="sm">{v} sm</Button>
        </div>
      ))}
    </div>
  ),
};
