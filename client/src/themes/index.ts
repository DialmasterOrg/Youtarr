// MUI removed — this module now only wires our theme definitions together.
// All actual styling is driven by CSS variables via ThemeEngineContext.
import { ThemeMode, ThemeDefinition } from './types';
import { playfulTheme } from './playful';
import { linearTheme } from './linear';
import { neumorphicTheme } from './neumorphic';
import { flatTheme } from './flat';

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

// createAppTheme is kept as a no-op stub so any remaining import sites don't
// cause compile errors during migration.  Delete callers, then delete this.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createAppTheme = (_mode: 'light' | 'dark', _themeId: ThemeMode): any => ({});
