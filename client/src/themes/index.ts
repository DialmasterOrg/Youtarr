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

export type { ThemeMode } from './types';

export const getThemeById = (id: ThemeMode): ThemeDefinition => {
  return ALL_THEMES[id] || playfulTheme;
};

const hslTripletPattern = /^-?[\d.]+\s+-?[\d.]+%\s+-?[\d.]+%$/;

const resolveColorValue = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('rgb') ||
    trimmed.startsWith('hsl') ||
    trimmed.startsWith('var(')
  ) {
    return trimmed;
  }

  if (hslTripletPattern.test(trimmed)) {
    return `hsl(${trimmed})`;
  }

  return trimmed;
};

export const createAppTheme = (mode: 'light' | 'dark', themeId: ThemeMode): Theme => {
  const themeDef = getThemeById(themeId);
  const modeTokens = themeDef.tokens[mode];

  const palette: ThemeOptions['palette'] = {
    mode,
    background: {
      default: resolveColorValue(modeTokens.background) || '#ffffff',
      paper:
        resolveColorValue(modeTokens.card) || resolveColorValue(modeTokens.background) || '#ffffff',
    },
    primary: {
      main: resolveColorValue(modeTokens.primary) || '#8b5cf6',
      contrastText: resolveColorValue(modeTokens['primary-foreground']) || '#ffffff',
    },
    secondary: {
      main: resolveColorValue(modeTokens.secondary) || '#6b7280',
      contrastText: resolveColorValue(modeTokens['secondary-foreground']) || '#ffffff',
    },
    text: {
      primary: resolveColorValue(modeTokens.foreground) || '#111827',
      secondary: resolveColorValue(modeTokens['muted-foreground']) || '#6b7280',
    },
    divider: resolveColorValue(modeTokens.border) || '#e5e7eb',
  };

  const themeOptions: ThemeOptions = {
    ...commonThemeOptions,
    palette,
    components: {
      ...commonThemeOptions.components,
      ...(themeDef.muiOverrides || {}),
    },
  };

  return createTheme(themeOptions);
};
