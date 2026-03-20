import React, { useEffect } from 'react';
import type { StoryObj } from '@storybook/react';
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

const meta = {
  title: 'Components/Configuration/Sections/AppearanceSettingsSection',
  component: AppearanceSettingsSection,
  decorators: [
    (Story: React.ComponentType) => (
      <ThemeEngineProvider>
        <ThemeInitializer>
          <Story />
        </ThemeInitializer>
      </ThemeEngineProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ThemeAndMotionControls: Story = {};
