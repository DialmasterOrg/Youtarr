/**
 * Material-UI Theme Configuration
 *
 * Defines light and dark theme palettes for the application.
 * Replaces hardcoded color values with theme-aware alternatives.
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { tokens } from './theme/tokens';

/**
 * Common theme options shared between light and dark modes
 */
const commonThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Oxygen',
      'Ubuntu',
      'Cantarell',
      '"Fira Sans"',
      '"Droid Sans"',
      '"Helvetica Neue"',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
  },
};

/**
 * Light theme configuration
 */
export const lightTheme = createTheme({
  ...commonThemeOptions,
  palette: {
    mode: 'light',
    primary: {
      main: tokens.colors.light.primary.main,
      light: tokens.colors.light.primary.light,
      dark: tokens.colors.light.primary.dark,
      contrastText: tokens.colors.light.primary.contrastText,
    },
    secondary: {
      main: tokens.colors.light.secondary.main,
      light: tokens.colors.light.secondary.light,
      dark: tokens.colors.light.secondary.dark,
      contrastText: tokens.colors.light.secondary.contrastText,
    },
    success: {
      main: tokens.colors.light.semantic.success,
      light: '#81c784',
      dark: '#388e3c',
      contrastText: '#fff',
    },
    error: {
      main: tokens.colors.light.semantic.error,
      light: '#ef5350',
      dark: '#c62828',
      contrastText: '#fff',
    },
    warning: {
      main: tokens.colors.light.semantic.warning,
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    info: {
      main: tokens.colors.light.semantic.info,
      light: '#03a9f4',
      dark: '#01579b',
      contrastText: '#fff',
    },
    background: {
      default: tokens.colors.light.background.default,
      paper: tokens.colors.light.background.surface,
    },
    text: {
      primary: tokens.colors.light.text.primary,
      secondary: tokens.colors.light.text.secondary,
      disabled: tokens.colors.light.text.disabled,
    },
    divider: 'rgba(0, 0, 0, 0.12)',
    action: {
      active: 'rgba(0, 0, 0, 0.54)',
      hover: 'rgba(0, 0, 0, 0.04)',
      selected: 'rgba(0, 0, 0, 0.08)',
      disabled: 'rgba(0, 0, 0, 0.26)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)',
    },
  },
});

/**
 * Dark theme configuration
 */
export const darkTheme = createTheme({
  ...commonThemeOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: tokens.colors.dark.primary.main,
      light: tokens.colors.dark.primary.light,
      dark: tokens.colors.dark.primary.dark,
      contrastText: tokens.colors.dark.primary.contrastText,
    },
    secondary: {
      main: tokens.colors.dark.secondary.main,
      light: tokens.colors.dark.secondary.light,
      dark: tokens.colors.dark.secondary.dark,
      contrastText: tokens.colors.dark.secondary.contrastText,
    },
    success: {
      main: tokens.colors.dark.semantic.success,
      light: '#81c784',
      dark: '#388e3c',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    error: {
      main: tokens.colors.dark.semantic.error,
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#fff',
    },
    warning: {
      main: tokens.colors.dark.semantic.warning,
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    info: {
      main: tokens.colors.dark.semantic.info,
      light: '#4fc3f7',
      dark: '#0288d1',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    background: {
      default: tokens.colors.dark.background.default,
      paper: tokens.colors.dark.background.surface,
    },
    text: {
      primary: tokens.colors.dark.text.primary,
      secondary: tokens.colors.dark.text.secondary,
      disabled: tokens.colors.dark.text.disabled,
    },
    divider: 'rgba(255, 255, 255, 0.12)',
    action: {
      active: '#fff',
      hover: 'rgba(255, 255, 255, 0.08)',
      selected: 'rgba(255, 255, 255, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
  },
});

/**
 * Extended palette colors for custom use cases
 * Access via theme.palette.grey[X]
 *
 * These are automatically included in both themes:
 * - Light theme: grey[50] through grey[900]
 * - Dark theme: Same scale, but appears lighter on dark backgrounds
 */

/**
 * Custom color utilities
 * For special use cases not covered by the standard palette
 */
export const customColors = {
  light: {
    // AppBar and navigation
    appBarBackground: '#eeeeee', // grey[200]
    drawerBackground: '#f5f5f5', // grey[100]
    navigationActive: 'rgba(0, 0, 0, 0.08)',
    navigationHover: 'rgba(0, 0, 0, 0.12)',
    navigationBorder: '#1976d2',

    // Error overlay
    errorOverlayBackdrop: 'rgba(0, 0, 0, 0.85)',
    errorListBackground: '#fef6f6',
    errorListBorder: '#ffcdd2',
    errorText: '#d32f2f',
    codeBlockBackground: '#f5f5f5',
    codeBlockInner: '#fff',
    warningBackground: '#fff8e1',
  },
  dark: {
    // AppBar and navigation
    appBarBackground: '#1e1e1e',
    drawerBackground: '#121212',
    navigationActive: 'rgba(255, 255, 255, 0.16)',
    navigationHover: 'rgba(255, 255, 255, 0.08)',
    navigationBorder: '#90caf9',

    // Error overlay
    errorOverlayBackdrop: 'rgba(0, 0, 0, 0.9)',
    errorListBackground: '#2d1b1b',
    errorListBorder: '#5f2120',
    errorText: '#f44336',
    codeBlockBackground: '#2d2d2d',
    codeBlockInner: '#1e1e1e',
    warningBackground: '#2d2a1b',
  },
};

/**
 * Helper to get custom colors based on theme mode
 */
export const getCustomColors = (mode: 'light' | 'dark') => {
  return customColors[mode];
};
