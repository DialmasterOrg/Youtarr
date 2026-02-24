import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Paper } from './paper';

const meta: Meta<typeof Paper> = {
  title: 'UI/Paper',
  component: Paper,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Paper>;

/* ─── Multiple Elevations ────────────────────────────── */
export const Elevations: Story = {
  name: 'Paper / Elevations Grid',
  render: () => (
    <div className="flex flex-wrap gap-6 p-4 bg-background">
      {[0, 1, 2, 3, 4, 6, 8, 16, 24].map((e) => (
        <Paper key={e} elevation={e} className="w-24 h-24 flex items-center justify-center">
          <span className="text-sm font-medium text-muted-foreground">e={e}</span>
        </Paper>
      ))}
    </div>
  ),
};

/* ─── Outlined ───────────────────────────────────────── */
export const Outlined: Story = {
  name: 'Paper / Outlined',
  render: () => (
    <Paper variant="outlined" className="w-64 p-4">
      <p className="text-sm text-foreground">Outlined paper — no shadow, just a border.</p>
    </Paper>
  ),
};

/* ─── Square ─────────────────────────────────────────── */
export const Square: Story = {
  name: 'Paper / Square (no border-radius)',
  render: () => (
    <Paper square elevation={3} className="w-64 p-4">
      <p className="text-sm text-foreground">Square paper — no rounded corners.</p>
    </Paper>
  ),
};

/* ─── With Content ───────────────────────────────────── */
export const WithContent: Story = {
  name: 'Paper / With Content',
  render: () => (
    <Paper elevation={2} className="w-80 p-6">
      <h3 className="font-bold text-base mb-2">Configuration Panel</h3>
      <p className="text-sm text-muted-foreground">
        Paper is a surface-level container that provides elevation and background. Use it for cards, panels, and overlays.
      </p>
      <div className="mt-4 flex gap-2">
        <button className="border border-border rounded px-3 py-1.5 text-sm hover:bg-muted transition-colors">
          Cancel
        </button>
        <button className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm hover:bg-primary/90 transition-colors">
          Save
        </button>
      </div>
    </Paper>
  ),
};
