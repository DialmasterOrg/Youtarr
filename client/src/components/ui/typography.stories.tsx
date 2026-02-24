import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Typography } from './typography';

const meta: Meta<typeof Typography> = {
  title: 'UI/Typography',
  component: Typography,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['h1','h2','h3','h4','h5','h6','subtitle1','subtitle2','body1','body2','caption','overline'],
    },
    color: {
      control: 'select',
      options: ['primary','secondary','textPrimary','textSecondary','error','warning','success','info'],
    },
    align: { control: 'select', options: ['left','center','right','justify'] },
  },
  args: { variant: 'body1', children: 'The quick brown fox jumps over the lazy dog.' },
};

export default meta;
type Story = StoryObj<typeof Typography>;

export const Body1: Story = { args: { variant: 'body1', children: 'Body 1 – default paragraph text.' } };
export const Body2: Story = { args: { variant: 'body2', children: 'Body 2 – smaller paragraph text.' } };
export const Caption: Story = { args: { variant: 'caption', children: 'Caption text – for supplementary info.' } };
export const Overline: Story = { args: { variant: 'overline', children: 'Overline Label' } };

export const AllHeadings: Story = {
  render: () => (
    <div className="space-y-3">
      <Typography variant="h1">H1 – Page Title</Typography>
      <Typography variant="h2">H2 – Section Title</Typography>
      <Typography variant="h3">H3 – Sub-section</Typography>
      <Typography variant="h4">H4 – Card Title</Typography>
      <Typography variant="h5">H5 – Small Heading</Typography>
      <Typography variant="h6">H6 – Label Heading</Typography>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-2">
      <Typography variant="h4">Typography Scale</Typography>
      <Typography variant="subtitle1">Subtitle 1 – semi-bold section label</Typography>
      <Typography variant="subtitle2">Subtitle 2 – smaller semi-bold label</Typography>
      <Typography variant="body1">Body 1 – standard reading text</Typography>
      <Typography variant="body2">Body 2 – compact reading text</Typography>
      <Typography variant="caption">Caption – supportive metadata</Typography>
      <Typography variant="overline">Overline – all-caps category label</Typography>
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="space-y-1">
      <Typography color="textPrimary">Primary text</Typography>
      <Typography color="textSecondary">Secondary / muted text</Typography>
      <Typography color="error">Error text</Typography>
      <Typography color="warning">Warning text</Typography>
      <Typography color="success">Success text</Typography>
      <Typography color="info">Info text</Typography>
    </div>
  ),
};

export const GutterBottom: Story = {
  render: () => (
    <div>
      <Typography variant="h5" gutterBottom>Heading with gutter</Typography>
      <Typography variant="body2">The heading above has a bottom margin.</Typography>
    </div>
  ),
};

export const NoWrap: Story = {
  render: () => (
    <div className="w-48 border border-dashed border-border p-2">
      <Typography noWrap>This very long text will be truncated with an ellipsis because noWrap is set.</Typography>
    </div>
  ),
};
