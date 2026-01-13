import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsIndex } from './SettingsIndex';

const meta: Meta<typeof SettingsIndex> = {
  title: 'Pages/Settings/SettingsIndex',
  component: SettingsIndex,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/settings']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SettingsIndex>;

export const Default: Story = {};
