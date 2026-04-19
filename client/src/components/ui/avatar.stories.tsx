import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    variant: { control: 'select', options: ['circular', 'rounded', 'square'] },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

// ─── Image ───────────────────────────────────────────────────────────────────
export const WithImage: Story = {
  args: {
    src: 'https://i.pravatar.cc/150?img=3',
    alt: 'User avatar',
    size: 'medium',
  },
};

// ─── Fallback (broken image → initials) ─────────────────────────────────────
export const WithFallback: Story = {
  args: {
    src: 'https://broken-url.invalid/image.png',
    alt: 'JD',
    size: 'medium',
    children: 'JD',
  },
};

// ─── Initials only ────────────────────────────────────────────────────────────
export const Initials: Story = {
  args: { children: 'YT', size: 'medium' },
};

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <Avatar size="small">S</Avatar>
      <Avatar size="medium">M</Avatar>
      <Avatar size="large">L</Avatar>
    </div>
  ),
};

// ─── Shape Variants ───────────────────────────────────────────────────────────
export const ShapeVariants: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar variant="circular">C</Avatar>
      <Avatar variant="rounded">R</Avatar>
      <Avatar variant="square">S</Avatar>
    </div>
  ),
};

// ─── Channel Thumbnails ───────────────────────────────────────────────────────
export const ChannelThumbnails: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {['Blippi', 'NFL', 'Cercle', 'Daily Show'].map((name) => (
        <div key={name} className="flex flex-col items-center gap-1">
          <Avatar variant="rounded" size="large" className="bg-primary text-primary-foreground">
            {name[0]}
          </Avatar>
          <span className="text-xs text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  ),
};
