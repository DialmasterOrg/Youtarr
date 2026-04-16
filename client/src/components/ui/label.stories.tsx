import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Label } from './label';

const meta: Meta<typeof Label> = {
  title: 'UI/Label',
  component: Label,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Label>;

export const Basic: Story = {
  name: 'Label / Basic',
  render: () => <Label>Channel Name</Label>,
};

export const Required: Story = {
  name: 'Label / Required (shows asterisk)',
  render: () => <Label required>Download Path</Label>,
};

export const Disabled: Story = {
  name: 'Label / Disabled (opacity-50)',
  render: () => <Label disabled>Inactive Field</Label>,
};

export const PairedWithInput: Story = {
  name: 'Label / Paired with Input',
  render: () => (
    <div className="flex flex-col gap-1 w-64">
      <Label htmlFor="channel-url" required>
        YouTube Channel URL
      </Label>
      <input
        id="channel-url"
        type="url"
        placeholder="https://youtube.com/@channel"
        className="border border-border rounded px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
      />
    </div>
  ),
};

export const AllVariants: Story = {
  name: 'Label / All Variants',
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label>Basic label</Label>
      </div>
      <div className="flex flex-col gap-1">
        <Label required>Required label</Label>
      </div>
      <div className="flex flex-col gap-1">
        <Label disabled>Disabled label</Label>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="sample-input" required>
          Label with htmlFor
        </Label>
        <input
          id="sample-input"
          type="text"
          className="border border-border rounded px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary w-48 transition-colors"
        />
      </div>
    </div>
  ),
};
