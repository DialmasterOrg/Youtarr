import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { AppShell } from './AppShell';

const meta: Meta<typeof AppShell> = {
  title: 'Layout/AppShell',
  component: AppShell,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/downloads']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    token: 'storybook-token',
    isPlatformManaged: false,
    appName: 'Youtarr',
    versionLabel: 'v0.0.0',
  },
};

export default meta;
type Story = StoryObj<typeof AppShell>;

export const Default: Story = {
  args: {
    children: (
      <Box>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Page Title
        </Typography>
        <Typography color="text.secondary">
          This is placeholder content inside the new shell.
        </Typography>
      </Box>
    ),
  },
};
