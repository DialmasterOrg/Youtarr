import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Snackbar } from './snackbar';

const meta: Meta = {
  title: 'UI/Snackbar',
  tags: ['autodocs'],
};
export default meta;

/* ─── Default Bottom-Center ──────────────────────────── */
export const DefaultBottomCenter: StoryObj = {
  name: 'Snackbar / Default Bottom-Center',
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Show Snackbar
        </button>
        <Snackbar
          open={open}
          message="This is a default snackbar message."
          autoHideDuration={null}
          onClose={() => setOpen(false)}
        />
      </div>
    );
  },
};

/* ─── Top-Right Position ─────────────────────────────── */
export const TopRight: StoryObj = {
  name: 'Snackbar / Top-Right',
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Show Top-Right Snackbar
        </button>
        <Snackbar
          open={open}
          message="Positioned top-right."
          autoHideDuration={null}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          onClose={() => setOpen(false)}
        />
      </div>
    );
  },
};

/* ─── With Undo Action ───────────────────────────────── */
export const WithUndoAction: StoryObj = {
  name: 'Snackbar / With Undo Action',
  render: () => {
    const [open, setOpen] = useState(false);
    const [undone, setUndone] = useState(false);

    const handleUndo = () => {
      setUndone(true);
      setOpen(false);
    };

    return (
      <div className="flex flex-col gap-3 items-start">
        <button
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => { setOpen(true); setUndone(false); }}
        >
          Delete Item
        </button>
        {undone && <p className="text-sm text-success">Undo successful!</p>}
        <Snackbar
          open={open}
          message="Item deleted."
          autoHideDuration={null}
          onClose={() => setOpen(false)}
          action={
            <button
              className="text-sm font-semibold text-primary hover:underline"
              onClick={handleUndo}
            >
              UNDO
            </button>
          }
        />
      </div>
    );
  },
};

/* ─── Auto-Hide ──────────────────────────────────────── */
export const AutoHide: StoryObj = {
  name: 'Snackbar / Auto-Hide (3s)',
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Trigger Auto-Hide Snackbar
        </button>
        <Snackbar
          open={open}
          message="This will close automatically in 3 seconds."
          autoHideDuration={3000}
          onClose={() => setOpen(false)}
        />
      </div>
    );
  },
};

/* ─── Custom Children ────────────────────────────────── */
export const CustomChildren: StoryObj = {
  name: 'Snackbar / Custom Children',
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Show Custom Snackbar
        </button>
        <Snackbar
          open={open}
          autoHideDuration={null}
          onClose={() => setOpen(false)}
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-success text-white rounded-lg shadow-hard min-w-[280px]">
            <span className="text-lg">✓</span>
            <div className="flex-1">
              <p className="text-sm font-medium">Download complete!</p>
              <p className="text-xs opacity-80">video.mp4 was saved successfully.</p>
            </div>
            <button
              className="text-white opacity-70 hover:opacity-100 text-xs"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
        </Snackbar>
      </div>
    );
  },
};
