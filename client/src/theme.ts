import { createAppTheme as createBaseAppTheme, ThemeMode } from './themes';

export const createAppTheme = (colorMode: 'light' | 'dark', themeMode: ThemeMode) => {
  return createBaseAppTheme(colorMode, themeMode);
};
