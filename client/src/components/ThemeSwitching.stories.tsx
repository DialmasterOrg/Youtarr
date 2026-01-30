import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useEffect } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ThemeEngineProvider, useThemeEngine } from '../contexts/ThemeEngineContext';

const ThemeToggleDemo = () => {
  const { themeMode, setThemeMode } = useThemeEngine();

  return (
    <Stack spacing={2} sx={{ p: 3, bgcolor: 'background.paper' }}>
      <Typography variant="h6">Theme Switch Verification</Typography>
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={() => setThemeMode('playful')}>Playful</Button>
        <Button variant="outlined" onClick={() => setThemeMode('linear')}>Industrial</Button>
      </Stack>
      <Box
        data-testid="radius-swatch"
        sx={{
          width: 80,
          height: 48,
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid var(--border)',
          bgcolor: 'var(--card)',
        }}
      />
      <Typography variant="caption">Current theme: {themeMode}</Typography>
    </Stack>
  );
};

const ThemeWrapper = ({ initialTheme, children }: { initialTheme: 'playful' | 'linear'; children: React.ReactNode }) => {
  const { setThemeMode } = useThemeEngine();

  useEffect(() => {
    setThemeMode(initialTheme);
  }, [initialTheme, setThemeMode]);

  return <>{children}</>;
};

const meta: Meta = {
  title: 'Diagnostics/ThemeSwitching',
  component: ThemeToggleDemo,
  decorators: [
    (Story) => (
      <ThemeEngineProvider>
        <ThemeWrapper initialTheme="playful">
          <Story />
        </ThemeWrapper>
      </ThemeEngineProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof ThemeToggleDemo>;

export const SwitchThemeRadius: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const radiusSwatch = canvas.getByTestId('radius-swatch');

    await userEvent.click(canvas.getByRole('button', { name: /playful/i }));
    expect(document.documentElement.style.getPropertyValue('--radius-ui').trim()).toBe('24px');
    await expect(radiusSwatch).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: /industrial/i }));
    expect(document.documentElement.style.getPropertyValue('--radius-ui').trim()).toBe('2px');
  },
};
