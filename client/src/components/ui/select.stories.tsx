import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Select, MenuItem } from './select';

const meta: Meta = {
  title: 'UI/Select',
  tags: ['autodocs'],
};
export default meta;

/* ─── Basic Select ───────────────────────────────────── */
export const BasicSelect: StoryObj = {
  name: 'Select / Basic',
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-48">
        <Select
          value={value}
          onChange={(e) => setValue(e.target.value as string)}
          placeholder="Choose one…"
        >
          <MenuItem value="apple">Apple</MenuItem>
          <MenuItem value="banana">Banana</MenuItem>
          <MenuItem value="cherry">Cherry</MenuItem>
        </Select>
      </div>
    );
  },
};

/* ─── With Label ─────────────────────────────────────── */
export const WithLabel: StoryObj = {
  name: 'Select / With Label',
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="flex flex-col gap-1 w-56">
        <label className="text-xs font-medium text-muted-foreground">Country</label>
        <Select
          value={value}
          onChange={(e) => setValue(e.target.value as string)}
          placeholder="Select country…"
        >
          <MenuItem value="us">United States</MenuItem>
          <MenuItem value="gb">United Kingdom</MenuItem>
          <MenuItem value="ca">Canada</MenuItem>
          <MenuItem value="au">Australia</MenuItem>
        </Select>
      </div>
    );
  },
};

/* ─── Error State ────────────────────────────────────── */
export const ErrorState: StoryObj = {
  name: 'Select / Error State',
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="flex flex-col gap-1 w-48">
        <label className="text-xs font-medium text-destructive">Format (required)</label>
        <Select
          value={value}
          onChange={(e) => setValue(e.target.value as string)}
          error
          placeholder="Pick a value…"
        >
          <MenuItem value="mp4">MP4</MenuItem>
          <MenuItem value="mkv">MKV</MenuItem>
        </Select>
        <p className="text-xs text-destructive">Please select a format.</p>
      </div>
    );
  },
};

/* ─── Disabled ───────────────────────────────────────── */
export const Disabled: StoryObj = {
  name: 'Select / Disabled',
  render: () => (
    <div className="w-48">
      <Select value="mp4" disabled>
        <MenuItem value="mp4">MP4</MenuItem>
        <MenuItem value="mkv">MKV</MenuItem>
      </Select>
    </div>
  ),
};

/* ─── Small Size ─────────────────────────────────────── */
export const SmallSize: StoryObj = {
  name: 'Select / Small Size',
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-40">
        <Select
          value={value}
          onChange={(e) => setValue(e.target.value as string)}
          size="small"
          placeholder="Small…"
        >
          <MenuItem value="a">Option A</MenuItem>
          <MenuItem value="b">Option B</MenuItem>
          <MenuItem value="c">Option C</MenuItem>
        </Select>
      </div>
    );
  },
};

/* ─── With Placeholder / displayEmpty ────────────────── */
export const WithPlaceholder: StoryObj = {
  name: 'Select / With Placeholder',
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-56">
        <Select
          value={value}
          onChange={(e) => setValue(e.target.value as string)}
          displayEmpty
          placeholder="— Select an option —"
        >
          <MenuItem value="one">One</MenuItem>
          <MenuItem value="two">Two</MenuItem>
          <MenuItem value="three">Three</MenuItem>
        </Select>
      </div>
    );
  },
};

/* ─── Download Format Selector ───────────────────────── */
export const DownloadFormatSelector: StoryObj = {
  name: 'Select / Download Format',
  render: () => {
    const [value, setValue] = useState('1080p');
    const formats = [
      { value: '1080p', label: '1080p (Full HD)' },
      { value: '720p', label: '720p (HD)' },
      { value: '480p', label: '480p (SD)' },
      { value: 'audio-only', label: 'Audio Only (MP3)' },
    ];
    return (
      <div className="flex flex-col gap-1 w-56">
        <label className="text-xs font-medium text-muted-foreground">Download Quality</label>
        <Select
          value={value}
          onChange={(e) => setValue(e.target.value as string)}
        >
          {formats.map((f) => (
            <MenuItem key={f.value} value={f.value}>
              {f.label}
            </MenuItem>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">Selected: {value}</p>
      </div>
    );
  },
};
