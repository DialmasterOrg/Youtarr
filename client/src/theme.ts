import { createAppTheme as createBaseAppTheme, ThemeMode } from './themes';

/**
 * Main theme creator helper
 */
export const createAppTheme = (mode: ThemeMode, colorMode: 'light' | 'dark' = 'light') => {
  return createBaseAppTheme(mode, colorMode);
};

/**
 * Legacy support for old theme exports
 */
export const lightTheme = createBaseAppTheme('playful', 'light');
export const darkTheme = createBaseAppTheme('playful', 'dark');
export const neumorphicTheme = createBaseAppTheme('neumorphic', 'dark');
export const linearTheme = createBaseAppTheme('linear', 'dark');
export const flatTheme = createBaseAppTheme('flat', 'light');

export const playfulTokens = {
  light: {},
  dark: {}
};

export const neumorphicTokens = {
  light: {}
};

export const linearTokens = {
  dark: {}
};

export const flatTokens = {
  light: {}
};

/**
 * Custom color utility (Legacy support)
 */
export const getCustomColors = (mode: 'light' | 'dark') => {
  return {
    appBarBackground: mode === 'light' ? '#eeeeee' : '#1e1e1e',
    drawerBackground: mode === 'light' ? '#f5f5f5' : '#121212',
    navigationActive: mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.16)',
    navigationHover: mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.08)',
    navigationBorder: mode === 'light' ? '#1976d2' : '#90caf9',
  };
};

export const customColors = {
  light: getCustomColors('light'),
  dark: getCustomColors('dark'),
};
