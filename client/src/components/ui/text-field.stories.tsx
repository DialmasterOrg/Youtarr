import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Search, Eye } from 'lucide-react';
import { TextField } from './text-field';

const meta: Meta<typeof TextField> = {
  title: 'UI/TextField',
  component: TextField,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof TextField>;

export const Basic: Story = {
  name: 'TextField / Basic',
  render: () => <TextField placeholder="Enter text..." className="w-64" />,
};

export const WithLabelAndHelper: Story = {
  name: 'TextField / Label + Helper Text',
  render: () => (
    <TextField
      label="Username"
      helperText="Your unique display name."
      placeholder=" "
      className="w-64"
    />
  ),
};

export const ErrorState: Story = {
  name: 'TextField / Error State',
  render: () => (
    <TextField
      label="Email"
      helperText="Invalid email address."
      error
      defaultValue="not-an-email"
      className="w-64"
    />
  ),
};

export const Disabled: Story = {
  name: 'TextField / Disabled',
  render: () => (
    <TextField
      label="Disabled Field"
      defaultValue="Cannot edit this"
      disabled
      className="w-64"
    />
  ),
};

export const Required: Story = {
  name: 'TextField / Required',
  render: () => (
    <TextField
      label="Required Field"
      required
      helperText="This field is required."
      className="w-64"
    />
  ),
};

export const SmallSize: Story = {
  name: 'TextField / Small Size',
  render: () => (
    <TextField
      label="Small"
      size="small"
      placeholder=" "
      className="w-48"
    />
  ),
};

export const WithStartAdornment: Story = {
  name: 'TextField / Start Adornment (Search icon)',
  render: () => (
    <TextField
      label="Search"
      placeholder=" "
      className="w-64"
      InputProps={{
        startAdornment: <Search />,
      }}
    />
  ),
};

export const WithEndAdornment: Story = {
  name: 'TextField / End Adornment',
  render: () => (
    <TextField
      label="Password"
      type="password"
      placeholder=" "
      className="w-64"
      InputProps={{
        endAdornment: <Eye />,
      }}
    />
  ),
};

export const Multiline: Story = {
  name: 'TextField / Multiline',
  render: () => (
    <TextField
      label="Description"
      multiline
      rows={4}
      placeholder=" "
      className="w-80"
    />
  ),
};

export const FullWidth: Story = {
  name: 'TextField / Full Width',
  render: () => (
    <div className="w-full max-w-lg">
      <TextField
        label="Full Width Field"
        fullWidth
        placeholder=" "
      />
    </div>
  ),
};

export const AllVariants: Story = {
  name: 'TextField / All Variants',
  render: () => (
    <div className="flex flex-col gap-4 w-72">
      {(['outlined', 'filled', 'standard'] as const).map((variant) => (
        <div key={variant} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground capitalize">{variant}</span>
          <TextField
            label={variant.charAt(0).toUpperCase() + variant.slice(1)}
            variant={variant}
            placeholder=" "
          />
        </div>
      ))}
    </div>
  ),
};
