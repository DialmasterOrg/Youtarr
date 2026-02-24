import type { Meta, StoryObj } from '@storybook/react';
import React, { useRef, useState } from 'react';
import { Pencil, Trash2, Download } from 'lucide-react';
import { Menu } from './menu';
import { MenuItem } from './select';

const meta: Meta = {
  title: 'UI/Menu',
  tags: ['autodocs'],
};
export default meta;

/* ─── Basic Dropdown Menu ────────────────────────────── */
export const BasicMenu: StoryObj = {
  name: 'Menu / Basic',
  render: () => {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    return (
      <div className="h-48 flex items-start pt-8 pl-8">
        <button
          ref={anchorRef}
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Open Menu ▾
        </button>
        <Menu open={open} anchorEl={anchorRef.current} onClose={() => setOpen(false)}>
          <MenuItem onClick={() => setOpen(false)}>Profile</MenuItem>
          <MenuItem onClick={() => setOpen(false)}>Settings</MenuItem>
          <MenuItem onClick={() => setOpen(false)}>Logout</MenuItem>
        </Menu>
      </div>
    );
  },
};

/* ─── With Icons ─────────────────────────────────────── */
export const MenuWithIcons: StoryObj = {
  name: 'Menu / With Icons',
  render: () => {
    const [open, setOpen] = useState(false);
    const [action, setAction] = useState<string | null>(null);
    const anchorRef = useRef<HTMLButtonElement>(null);

    const handleAction = (label: string) => {
      setAction(label);
      setOpen(false);
    };

    return (
      <div className="h-48 flex flex-col items-start gap-3 pt-4 pl-8">
        <button
          ref={anchorRef}
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Actions ▾
        </button>
        {action && <p className="text-xs text-muted-foreground">Last action: {action}</p>}
        <Menu open={open} anchorEl={anchorRef.current} onClose={() => setOpen(false)}>
          <MenuItem onClick={() => handleAction('Edit')}>
            <Pencil className="h-4 w-4" />
            Edit
          </MenuItem>
          <MenuItem onClick={() => handleAction('Download')}>
            <Download className="h-4 w-4" />
            Download
          </MenuItem>
          <MenuItem onClick={() => handleAction('Delete')}>
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="text-destructive">Delete</span>
          </MenuItem>
        </Menu>
      </div>
    );
  },
};

/* ─── Menu with Divider (grouped sections) ───────────── */
export const MenuWithDivider: StoryObj = {
  name: 'Menu / With Divider Groups',
  render: () => {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    return (
      <div className="h-64 flex items-start pt-8 pl-8">
        <button
          ref={anchorRef}
          className="border border-border rounded px-4 py-2 text-sm hover:bg-muted transition-colors"
          onClick={() => setOpen(true)}
        >
          Channel Options ▾
        </button>
        <Menu open={open} anchorEl={anchorRef.current} onClose={() => setOpen(false)}>
          {/* Group 1: Edit actions */}
          <MenuItem onClick={() => setOpen(false)}>
            <Pencil className="h-4 w-4" />
            Edit Channel
          </MenuItem>
          <MenuItem divider onClick={() => setOpen(false)}>
            <Download className="h-4 w-4" />
            Force Download Now
          </MenuItem>
          {/* Group 2: Destructive */}
          <MenuItem onClick={() => setOpen(false)}>
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="text-destructive">Remove Channel</span>
          </MenuItem>
        </Menu>
      </div>
    );
  },
};
