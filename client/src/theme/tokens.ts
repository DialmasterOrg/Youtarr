import tokenData from './tokens.json';

export const tokens = tokenData;

export type ThemeMode = 'light' | 'dark';

export const getModeTokens = (mode: ThemeMode) => tokens.colors[mode];

export const tokenTypography = tokens.typography;
export const tokenSpacing = tokens.spacing;
export const tokenRadius = tokens.radius;

export const cssVarName = {
  bgDefault: '--app-bg-default',
  bgSurface: '--app-bg-surface',
  textPrimary: '--app-text-primary',
  textSecondary: '--app-text-secondary',
  primaryMain: '--app-primary-main',
  secondaryMain: '--app-secondary-main',
  success: '--app-success',
  warning: '--app-warning',
  error: '--app-error',
  info: '--app-info',
} as const;

export const getCssVarsForMode = (mode: ThemeMode) => {
  const modeTokens = getModeTokens(mode);

  return {
    [cssVarName.bgDefault]: modeTokens.background.default,
    [cssVarName.bgSurface]: modeTokens.background.surface,
    [cssVarName.textPrimary]: modeTokens.text.primary,
    [cssVarName.textSecondary]: modeTokens.text.secondary,
    [cssVarName.primaryMain]: modeTokens.primary.main,
    [cssVarName.secondaryMain]: modeTokens.secondary.main,
    [cssVarName.success]: modeTokens.semantic.success,
    [cssVarName.warning]: modeTokens.semantic.warning,
    [cssVarName.error]: modeTokens.semantic.error,
    [cssVarName.info]: modeTokens.semantic.info,
  };
};
