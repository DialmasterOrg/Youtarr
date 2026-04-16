import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import {
  Switch,
  Checkbox,
  FormControlLabel,
  FormControl,
  FormHelperText,
  InputLabel,
  RadioGroup,
  RadioGroupItem,
} from './form';

const meta: Meta = {
  title: 'UI/Form',
  tags: ['autodocs'],
};
export default meta;

/* ─── Switch ─────────────────────────────────────────── */
export const SwitchUnchecked: StoryObj = {
  name: 'Switch / Unchecked',
  render: () => <Switch />,
};

export const SwitchChecked: StoryObj = {
  name: 'Switch / Checked',
  render: () => <Switch checked />,
};

export const SwitchSmall: StoryObj = {
  name: 'Switch / Small',
  render: () => (
    <div className="flex gap-4 items-center">
      <Switch size="small" />
      <Switch size="small" checked />
    </div>
  ),
};

export const SwitchDisabled: StoryObj = {
  name: 'Switch / Disabled',
  render: () => (
    <div className="flex gap-4 items-center">
      <Switch disabled />
      <Switch disabled checked />
    </div>
  ),
};

/* ─── Checkbox ───────────────────────────────────────── */
export const CheckboxUnchecked: StoryObj = {
  name: 'Checkbox / Unchecked',
  render: () => <Checkbox />,
};

export const CheckboxChecked: StoryObj = {
  name: 'Checkbox / Checked',
  render: () => <Checkbox checked />,
};

export const CheckboxIndeterminate: StoryObj = {
  name: 'Checkbox / Indeterminate',
  render: () => <Checkbox indeterminate />,
};

export const CheckboxDisabled: StoryObj = {
  name: 'Checkbox / Disabled',
  render: () => (
    <div className="flex gap-4 items-center">
      <Checkbox disabled />
      <Checkbox disabled checked />
    </div>
  ),
};

/* ─── FormControlLabel ───────────────────────────────── */
export const FormControlLabelWithSwitch: StoryObj = {
  name: 'FormControlLabel / With Switch',
  render: () => (
    <div className="flex flex-col gap-3">
      <FormControlLabel control={<Switch />} label="Enable notifications" />
      <FormControlLabel control={<Switch checked />} label="Dark mode" />
      <FormControlLabel control={<Switch />} label="Disabled" disabled />
    </div>
  ),
};

export const FormControlLabelWithCheckbox: StoryObj = {
  name: 'FormControlLabel / With Checkbox',
  render: () => (
    <div className="flex flex-col gap-3">
      <FormControlLabel control={<Checkbox />} label="Accept terms" />
      <FormControlLabel control={<Checkbox checked />} label="Subscribe to newsletter" />
      <FormControlLabel control={<Checkbox indeterminate />} label="Select all" />
      <FormControlLabel control={<Checkbox />} label="Disabled option" disabled />
    </div>
  ),
};

/* ─── FormControl + InputLabel + FormHelperText ──────── */
export const FormControlWithHelperText: StoryObj = {
  name: 'FormControl / With Helper Text',
  render: () => (
    <div className="flex flex-col gap-4 w-64">
      <FormControl>
        <InputLabel htmlFor="example-input">Username</InputLabel>
        <input
          id="example-input"
          type="text"
          className="border border-border rounded px-3 py-2 text-sm bg-transparent outline-none focus:border-primary"
        />
        <FormHelperText>Enter your unique username.</FormHelperText>
      </FormControl>
      <FormControl error>
        <InputLabel htmlFor="error-input" error>Email</InputLabel>
        <input
          id="error-input"
          type="email"
          className="border border-destructive rounded px-3 py-2 text-sm bg-transparent outline-none"
        />
        <FormHelperText error>Invalid email address.</FormHelperText>
      </FormControl>
    </div>
  ),
};

/* ─── RadioGroup ─────────────────────────────────────── */
export const RadioGroupStory: StoryObj = {
  name: 'RadioGroup / With Items',
  render: () => (
    <RadioGroup defaultValue="option-b">
      {['option-a', 'option-b', 'option-c'].map((val) => (
        <div key={val} className="flex items-center gap-2">
          <RadioGroupItem value={val} id={val} />
          <label htmlFor={val} className="text-sm cursor-pointer select-none">
            {val.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </label>
        </div>
      ))}
    </RadioGroup>
  ),
};

export const RadioGroupDisabled: StoryObj = {
  name: 'RadioGroup / Disabled Items',
  render: () => (
    <RadioGroup defaultValue="opt-1">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="opt-1" id="opt-1" />
        <label htmlFor="opt-1" className="text-sm">Enabled</label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="opt-2" id="opt-2" disabled />
        <label htmlFor="opt-2" className="text-sm opacity-50">Disabled</label>
      </div>
    </RadioGroup>
  ),
};
