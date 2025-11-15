/**
 * Material-UI Theme Configuration
 *
 * Defines light and dark theme palettes for the application.
 * Replaces hardcoded color values with theme-aware alternatives.
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';

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
      main: '#1976d2', // Material-UI default blue
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#fff',
    },
    secondary: {
      main: '#dc004e',
      light: '#e33371',
      dark: '#9a0036',
      contrastText: '#fff',
    },
    success: {
      main: '#4caf50', // Used for authenticated state
      light: '#81c784',
      dark: '#388e3c',
      contrastText: '#fff',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
      contrastText: '#fff',
    },
    warning: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    info: {
      main: '#0288d1',
      light: '#03a9f4',
      dark: '#01579b',
      contrastText: '#fff',
    },
    background: {
      default: '#fafafa',
      paper: '#fff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
      disabled: 'rgba(0, 0, 0, 0.38)',
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
      main: '#90caf9', // Lighter blue for better contrast on dark backgrounds
      light: '#e3f2fd',
      dark: '#42a5f5',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    secondary: {
      main: '#f48fb1',
      light: '#ffc1e3',
      dark: '#bf5f82',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    success: {
      main: '#66bb6a',
      light: '#81c784',
      dark: '#388e3c',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#fff',
    },
    warning: {
      main: '#ffa726',
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    info: {
      main: '#29b6f6',
      light: '#4fc3f7',
      dark: '#0288d1',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#fff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.5)',
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
