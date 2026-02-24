import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Card, CardActionArea, CardContent, CardHeader } from './card';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Card>;

export const BasicCard: Story = {
  name: 'Card / Basic',
  render: () => (
    <Card className="w-64">
      <CardContent>
        <p className="text-sm">This is a basic card with some content inside it.</p>
      </CardContent>
    </Card>
  ),
};

export const OutlinedCard: Story = {
  name: 'Card / Outlined',
  render: () => (
    <Card variant="outlined" className="w-64">
      <CardContent>
        <p className="text-sm">Outlined card — no elevation shadow.</p>
      </CardContent>
    </Card>
  ),
};

export const CardWithHeader: Story = {
  name: 'Card / With Header',
  render: () => (
    <Card className="w-72">
      <CardHeader title="Card Title" subheader="Secondary text below the title" />
      <CardContent>
        <p className="text-sm text-muted-foreground">Card body content goes here.</p>
      </CardContent>
    </Card>
  ),
};

export const CardWithAvatarAndAction: Story = {
  name: 'Card / Avatar + Action',
  render: () => (
    <Card className="w-72">
      <CardHeader
        avatar={
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            AB
          </div>
        }
        title="Channel Name"
        subheader="Updated 3 hours ago"
        action={
          <button className="text-xs border border-border rounded px-2 py-1 hover:bg-muted transition-colors">
            Options
          </button>
        }
      />
    </Card>
  ),
};

export const DisabledCard: Story = {
  name: 'Card / Disabled',
  render: () => (
    <Card disabled className="w-64">
      <CardContent>
        <p className="text-sm">This card is disabled (pointer-events-none, opacity-50).</p>
      </CardContent>
    </Card>
  ),
};

export const ClickableCard: Story = {
  name: 'Card / Clickable (CardActionArea)',
  render: () => (
    <Card className="w-64">
      <CardActionArea onClick={() => alert('Card clicked!')}>
        <CardContent>
          <p className="text-sm font-medium">Click me!</p>
          <p className="text-xs text-muted-foreground mt-1">This entire card is clickable via CardActionArea.</p>
        </CardContent>
      </CardActionArea>
    </Card>
  ),
};

export const FullChannelCard: Story = {
  name: 'Card / Full Channel Mock',
  render: () => (
    <Card className="w-80">
      <CardHeader
        avatar={
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
            YT
          </div>
        }
        title="Youtarr Official"
        subheader="youtube.com/@youtarr"
        action={
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
            ···
          </button>
        }
      />
      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>142 videos downloaded</span>
          <span className="bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">Active</span>
        </div>
      </CardContent>
    </Card>
  ),
};
