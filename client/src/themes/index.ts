// This module wires our theme definitions together.
// All styling is driven by CSS variables via ThemeEngineContext.
import { ThemeMode, ThemeDefinition } from './types';
import { playfulTheme } from './playful';
import { linearTheme } from './linear';
import { flatTheme } from './flat';
export { FALLBACK_LAYOUT_POLICY, getThemeLayoutCssVars, resolveThemeLayoutPolicy } from './layoutPolicy';

export const ALL_THEMES: Record<ThemeMode, ThemeDefinition> = {
  playful: playfulTheme,
  linear: linearTheme,
  flat: flatTheme,
};

export type { ThemeBreakpoint, ThemeLayoutPolicy, ThemeMode } from './types';

export const getThemeById = (id: ThemeMode): ThemeDefinition => {
  return ALL_THEMES[id] || playfulTheme;
};

// createAppTheme is kept as a no-op stub so any remaining import sites don't
// cause compile errors during migration.  Delete callers, then delete this.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createAppTheme = (_mode: 'light' | 'dark', _themeId: ThemeMode): any => ({});
