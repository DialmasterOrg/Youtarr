import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentBody, DialogContentText, DialogActions } from './dialog';

const meta: Meta = {
  title: 'UI/Dialog',
  tags: ['autodocs'],
};
export default meta;

/* ─── Default Dialog ─────────────────────────────────── */
export const DefaultDialog: StoryObj = {
  name: 'Dialog / Default',
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Open Dialog
        </button>
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogContentBody>
            <DialogContentText>
              This is the dialog body. You can place any content here. Press the backdrop or Escape to close.
            </DialogContentText>
          </DialogContentBody>
          <DialogActions>
            <button
              className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </DialogActions>
        </Dialog>
      </div>
    );
  },
};

/* ─── Full Screen Dialog ─────────────────────────────── */
export const FullScreenDialog: StoryObj = {
  name: 'Dialog / Full Screen',
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Open Full Screen Dialog
        </button>
        <Dialog open={open} onClose={() => setOpen(false)} fullScreen>
          <DialogTitle onClose={() => setOpen(false)}>Full Screen Dialog</DialogTitle>
          <DialogContentBody>
            <DialogContentText>
              This dialog takes the full viewport. Useful for mobile or complex forms.
            </DialogContentText>
          </DialogContentBody>
          <DialogActions>
            <button
              className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </DialogActions>
        </Dialog>
      </div>
    );
  },
};

/* ─── Dialog with Close Button in Title ──────────────── */
export const DialogWithCloseButton: StoryObj = {
  name: 'Dialog / With Close Button in Title',
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Open Dialog with Close ✕
        </button>
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm">
          <DialogTitle onClose={() => setOpen(false)}>Settings</DialogTitle>
          <DialogContentBody>
            <DialogContentText>
              The DialogTitle receives an <code>onClose</code> prop which renders an ✕ button in the header.
            </DialogContentText>
          </DialogContentBody>
          <DialogActions>
            <button
              className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </DialogActions>
        </Dialog>
      </div>
    );
  },
};

/* ─── Confirmation Dialog ────────────────────────────── */
export const ConfirmationDialog: StoryObj = {
  name: 'Dialog / Confirmation Pattern',
  render: () => {
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const handleConfirm = () => {
      setResult('Confirmed ✓');
      setOpen(false);
    };
    const handleCancel = () => {
      setResult('Cancelled ✗');
      setOpen(false);
    };

    return (
      <div className="flex flex-col gap-4 items-start">
        <button
          className="border border-destructive text-destructive rounded px-4 py-2 text-sm hover:bg-destructive/10 transition-colors"
          onClick={() => setOpen(true)}
        >
          Delete Item
        </button>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
        <Dialog open={open} onClose={handleCancel} maxWidth="xs">
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogContentBody>
            <DialogContentText>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogContentText>
          </DialogContentBody>
          <DialogActions>
            <button
              className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className="bg-destructive text-destructive-foreground rounded px-4 py-2 text-sm hover:bg-destructive/90 transition-colors"
              onClick={handleConfirm}
            >
              Delete
            </button>
          </DialogActions>
        </Dialog>
      </div>
    );
  },
};
