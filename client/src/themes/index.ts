import { createTheme, ThemeOptions, Theme } from '@mui/material/styles';
import { ThemeMode, ThemeDefinition } from './types';
import { playfulTheme } from './playful';
import { linearTheme } from './linear';
import { neumorphicTheme } from './neumorphic';
import { flatTheme } from './flat';
import { commonThemeOptions } from './shared';

export const ALL_THEMES: Record<ThemeMode, ThemeDefinition> = {
  playful: playfulTheme,
  linear: linearTheme,
  neumorphic: neumorphicTheme,
  flat: flatTheme,
};

export const getThemeById = (id: ThemeMode): ThemeDefinition => {
  return ALL_THEMES[id] || playfulTheme;
};

export const createAppTheme = (mode: 'light' | 'dark', themeId: ThemeMode): Theme => {
  const themeDef = getThemeById(themeId);
  
  // Merge shared config with base mode and then add theme-specific overrides
  const themeOptions: ThemeOptions = {
    ...commonThemeOptions,
    palette: {
      mode,
      primary: {
        main: themeDef.tokens[mode]['primary'] ? `hsl(${themeDef.tokens[mode]['primary']})` : '#8b5cf6',
      },
    },
    components: {
      ...commonThemeOptions.components,
      ...(themeDef.muiOverrides || {}),
    },
  };

  return createTheme(themeOptions);
};
