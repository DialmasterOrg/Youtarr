import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Tooltip } from './tooltip';

const meta: Meta = {
  title: 'UI/Tooltip',
  tags: ['autodocs'],
};
export default meta;

/* ─── Default (top) ──────────────────────────────────── */
export const DefaultTop: StoryObj = {
  name: 'Tooltip / Default Top',
  render: () => (
    <div className="flex items-center justify-center h-24">
      <Tooltip title="This is a tooltip">
        <button className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors">
          Hover me
        </button>
      </Tooltip>
    </div>
  ),
};

/* ─── With Arrow ─────────────────────────────────────── */
export const WithArrow: StoryObj = {
  name: 'Tooltip / With Arrow',
  render: () => (
    <div className="flex items-center justify-center h-24">
      <Tooltip title="Tooltip with arrow" arrow>
        <button className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors">
          Arrow tooltip
        </button>
      </Tooltip>
    </div>
  ),
};

/* ─── All Placements ─────────────────────────────────── */
export const AllPlacements: StoryObj = {
  name: 'Tooltip / All Placements',
  render: () => {
    const placements = [
      'top-start', 'top', 'top-end',
      'left', 'right',
      'bottom-start', 'bottom', 'bottom-end',
    ] as const;

    return (
      <div className="grid grid-cols-3 gap-4 p-16 place-items-center">
        {placements.map((placement) => (
          <Tooltip key={placement} title={placement} placement={placement}>
            <button className="border border-border rounded px-3 py-1.5 text-xs hover:bg-muted transition-colors w-28 text-center">
              {placement}
            </button>
          </Tooltip>
        ))}
      </div>
    );
  },
};

/* ─── Controlled Tooltip ─────────────────────────────── */
export const ControlledTooltip: StoryObj = {
  name: 'Tooltip / Controlled',
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex flex-col items-center gap-4 h-24 justify-center">
        <div className="flex gap-2">
          <button
            className="border border-border rounded px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            onClick={() => setOpen(true)}
          >
            Show
          </button>
          <button
            className="border border-border rounded px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            Hide
          </button>
        </div>
        <Tooltip title="I am controlled" open={open}>
          <span className="border border-primary rounded px-4 py-2 text-sm select-none">
            Target element
          </span>
        </Tooltip>
      </div>
    );
  },
};

/* ─── No Title = Just Children ───────────────────────── */
export const NoTitle: StoryObj = {
  name: 'Tooltip / No Title (renders children only)',
  render: () => (
    <Tooltip title="">
      <button className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors">
        No tooltip here
      </button>
    </Tooltip>
  ),
};
