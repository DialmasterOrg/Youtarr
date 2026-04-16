import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { LinearProgress, CircularProgress } from './progress';

const meta: Meta<typeof LinearProgress> = {
  title: 'UI/Progress',
  component: LinearProgress,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof LinearProgress>;

/* ─── LinearProgress ─────────────────────────────────── */
export const Indeterminate: Story = {
  name: 'Linear / Indeterminate',
  render: () => <LinearProgress className="w-64" />,
};

export const DeterminateValues: Story = {
  name: 'Linear / Determinate Values',
  render: () => (
    <div className="flex flex-col gap-4 w-64">
      {[0, 25, 50, 75, 100].map((v) => (
        <div key={v} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{v}%</span>
          <LinearProgress variant="determinate" value={v} />
        </div>
      ))}
    </div>
  ),
};

export const AllColors: Story = {
  name: 'Linear / All Colors',
  render: () => (
    <div className="flex flex-col gap-3 w-64">
      {(['primary', 'secondary', 'error', 'warning', 'info', 'success'] as const).map((color) => (
        <div key={color} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground capitalize">{color}</span>
          <LinearProgress variant="determinate" value={70} color={color} />
        </div>
      ))}
    </div>
  ),
};

export const CustomHeight: Story = {
  name: 'Linear / Custom Height',
  render: () => (
    <div className="flex flex-col gap-4 w-64">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">4px height</span>
        <LinearProgress variant="determinate" value={60} height={4} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">8px height</span>
        <LinearProgress variant="determinate" value={60} height={8} />
      </div>
    </div>
  ),
};

export const CustomBarColor: Story = {
  name: 'Linear / Custom Bar Color',
  render: () => (
    <div className="flex flex-col gap-4 w-64">
      <LinearProgress variant="determinate" value={55} barColor="#8b5cf6" />
      <LinearProgress variant="determinate" value={75} barColor="#f59e0b" />
      <LinearProgress variant="determinate" value={90} barColor="#10b981" />
    </div>
  ),
};

/* ─── CircularProgress ───────────────────────────────── */
export const CircularIndeterminate: StoryObj = {
  name: 'Circular / Indeterminate',
  render: () => (
    <div className="flex gap-6 items-center">
      <CircularProgress />
      <CircularProgress color="secondary" />
      <CircularProgress color="error" />
      <CircularProgress color="success" />
    </div>
  ),
};

export const CircularDeterminate: StoryObj = {
  name: 'Circular / Determinate',
  render: () => (
    <div className="flex gap-6 items-center">
      {[25, 50, 75, 100].map((v) => (
        <div key={v} className="flex flex-col items-center gap-1">
          <CircularProgress variant="determinate" value={v} />
          <span className="text-xs text-muted-foreground">{v}%</span>
        </div>
      ))}
    </div>
  ),
};

export const CircularSizes: StoryObj = {
  name: 'Circular / Sizes',
  render: () => (
    <div className="flex gap-6 items-end">
      <CircularProgress size={24} />
      <CircularProgress size={40} />
      <CircularProgress size={56} />
      <CircularProgress size={72} />
    </div>
  ),
};
