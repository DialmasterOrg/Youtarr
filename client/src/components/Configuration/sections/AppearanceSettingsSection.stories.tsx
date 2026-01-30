import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useEffect } from 'react';
import { ThemeEngineProvider, useThemeEngine } from '../../../contexts/ThemeEngineContext';
import { AppearanceSettingsSection } from './AppearanceSettingsSection';

const ThemeInitializer = ({ children }: { children: React.ReactNode }) => {
  const { setThemeMode, setMotionEnabled } = useThemeEngine();

  useEffect(() => {
    setThemeMode('playful');
    setMotionEnabled(false);
  }, [setThemeMode, setMotionEnabled]);

  return <>{children}</>;
};

const meta: Meta<typeof AppearanceSettingsSection> = {
  title: 'Components/Configuration/Sections/AppearanceSettingsSection',
  component: AppearanceSettingsSection,
  decorators: [
    (Story) => (
      <ThemeEngineProvider>
        <ThemeInitializer>
          <Story />
        </ThemeInitializer>
      </ThemeEngineProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AppearanceSettingsSection>;

export const ThemeAndMotionControls: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const motionToggle = await canvas.findByRole('checkbox', {
      name: /enable theme animations & motion/i,
    });
    await userEvent.click(motionToggle);
    await expect(motionToggle).toBeChecked();
    await expect(document.body.dataset.motion).toBe('on');

    const linearCard = await canvas.findByRole('button', { name: /select dark modern/i });
    await userEvent.click(linearCard);
    await expect(document.body.dataset.theme).toBe('linear');

    const playfulCard = await canvas.findByRole('button', { name: /select playful/i });
    await userEvent.click(playfulCard);
    await expect(document.body.dataset.theme).toBe('playful');
  },
};