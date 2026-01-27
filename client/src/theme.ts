import { createAppTheme as createBaseAppTheme, ThemeMode } from './themes';

export const createAppTheme = (mode: ThemeMode, colorMode: 'light' | 'dark' = 'light') => {
  return createBaseAppTheme(mode, colorMode);
};
