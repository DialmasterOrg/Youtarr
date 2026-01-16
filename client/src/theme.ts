/**
 * Material-UI Theme Configuration
 *
 * Defines light and dark theme palettes for the application.
 * Replaces hardcoded color values with theme-aware alternatives.
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';

const playfulTokens = {
  light: {
    background: '#FFFDF5',
    foreground: '#1E293B',
    muted: '#F1F5F9',
    mutedForeground: '#64748B',
    primary: '#8B5CF6',
    primaryForeground: '#FFFFFF',
    secondary: '#F472B6',
    tertiary: '#FBBF24',
    quaternary: '#34D399',
    border: '#E2E8F0',
    input: '#FFFFFF',
    card: '#FFFFFF',
    ring: '#8B5CF6',
  },
  dark: {
    background: '#0F172A',
    foreground: '#FFFDF5',
    muted: '#1E293B',
    mutedForeground: '#CBD5E1',
    primary: '#A78BFA',
    primaryForeground: '#0F172A',
    secondary: '#FB7185',
    tertiary: '#FACC15',
    quaternary: '#34D399',
    border: '#334155',
    input: '#111827',
    card: '#1E293B',
    ring: '#A78BFA',
  },
};

/**
 * Common theme options shared between light and dark modes
 */
const commonThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: [
      '"Plus Jakarta Sans"',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'sans-serif',
    ].join(','),
    h1: { fontFamily: '"Outfit", system-ui, sans-serif', fontWeight: 800 },
    h2: { fontFamily: '"Outfit", system-ui, sans-serif', fontWeight: 800 },
    h3: { fontFamily: '"Outfit", system-ui, sans-serif', fontWeight: 800 },
    h4: { fontFamily: '"Outfit", system-ui, sans-serif', fontWeight: 700 },
    h5: { fontFamily: '"Outfit", system-ui, sans-serif', fontWeight: 700 },
    h6: { fontFamily: '"Outfit", system-ui, sans-serif', fontWeight: 700 },
    button: { fontWeight: 700 },
  },
  shape: {
    borderRadius: 16,
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
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '2px solid var(--border)',
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '2px solid var(--foreground)',
          boxShadow: 'var(--shadow-soft)',
          transition: 'transform 300ms var(--transition-bouncy), box-shadow 300ms var(--transition-bouncy)',
          '&:hover': {
            transform: 'var(--card-hover-transform)',
            boxShadow: 'var(--card-hover-shadow)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          border: '2px solid var(--foreground)',
          boxShadow: 'var(--shadow-hard)',
          textTransform: 'none',
          fontWeight: 700,
          transition:
            'transform 300ms var(--transition-bouncy), box-shadow 300ms var(--transition-bouncy), background-color 300ms var(--transition-bouncy)',
          '&:hover': {
            transform: 'translate(-2px, -2px)',
            boxShadow: 'var(--shadow-hard-hover)',
          },
          '&:active': {
            transform: 'translate(2px, 2px)',
            boxShadow: 'var(--shadow-hard-active)',
          },
        },
        containedPrimary: {
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
        },
        containedSecondary: {
          backgroundColor: 'var(--secondary)',
          color: 'var(--foreground)',
        },
        outlined: {
          border: '2px solid var(--foreground)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: 'var(--input)',
          transition: 'box-shadow 250ms var(--transition-bouncy), border-color 250ms var(--transition-bouncy)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--border)',
            borderWidth: 2,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--foreground)',
          },
          '&.Mui-focused': {
            boxShadow: 'var(--shadow-hard-ring)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--ring)',
            borderWidth: 2,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          border: '2px solid var(--foreground)',
          fontWeight: 600,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
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
      main: playfulTokens.light.primary,
      light: playfulTokens.light.primary,
      dark: playfulTokens.light.primary,
      contrastText: playfulTokens.light.primaryForeground,
    },
    secondary: {
      main: playfulTokens.light.secondary,
      light: playfulTokens.light.secondary,
      dark: playfulTokens.light.secondary,
      contrastText: playfulTokens.light.foreground,
    },
    success: {
      main: playfulTokens.light.quaternary,
      light: playfulTokens.light.quaternary,
      dark: playfulTokens.light.quaternary,
      contrastText: playfulTokens.light.foreground,
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
      contrastText: '#ffffff',
    },
    warning: {
      main: playfulTokens.light.tertiary,
      light: playfulTokens.light.tertiary,
      dark: playfulTokens.light.tertiary,
      contrastText: playfulTokens.light.foreground,
    },
    info: {
      main: playfulTokens.light.primary,
      light: playfulTokens.light.primary,
      dark: playfulTokens.light.primary,
      contrastText: playfulTokens.light.primaryForeground,
    },
    background: {
      default: playfulTokens.light.background,
      paper: playfulTokens.light.card,
    },
    text: {
      primary: playfulTokens.light.foreground,
      secondary: playfulTokens.light.mutedForeground,
      disabled: 'rgba(100, 116, 139, 0.6)',
    },
    divider: playfulTokens.light.border,
    action: {
      active: playfulTokens.light.foreground,
      hover: 'rgba(139, 92, 246, 0.08)',
      selected: 'rgba(139, 92, 246, 0.14)',
      disabled: 'rgba(100, 116, 139, 0.6)',
      disabledBackground: 'rgba(226, 232, 240, 0.7)',
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
      main: playfulTokens.dark.primary,
      light: playfulTokens.dark.primary,
      dark: playfulTokens.dark.primary,
      contrastText: playfulTokens.dark.primaryForeground,
    },
    secondary: {
      main: playfulTokens.dark.secondary,
      light: playfulTokens.dark.secondary,
      dark: playfulTokens.dark.secondary,
      contrastText: playfulTokens.dark.foreground,
    },
    success: {
      main: playfulTokens.dark.quaternary,
      light: playfulTokens.dark.quaternary,
      dark: playfulTokens.dark.quaternary,
      contrastText: playfulTokens.dark.foreground,
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
      contrastText: '#ffffff',
    },
    warning: {
      main: playfulTokens.dark.tertiary,
      light: playfulTokens.dark.tertiary,
      dark: playfulTokens.dark.tertiary,
      contrastText: playfulTokens.dark.foreground,
    },
    info: {
      main: playfulTokens.dark.primary,
      light: playfulTokens.dark.primary,
      dark: playfulTokens.dark.primary,
      contrastText: playfulTokens.dark.primaryForeground,
    },
    background: {
      default: playfulTokens.dark.background,
      paper: playfulTokens.dark.card,
    },
    text: {
      primary: playfulTokens.dark.foreground,
      secondary: playfulTokens.dark.mutedForeground,
      disabled: 'rgba(148, 163, 184, 0.7)',
    },
    divider: playfulTokens.dark.border,
    action: {
      active: playfulTokens.dark.foreground,
      hover: 'rgba(139, 92, 246, 0.2)',
      selected: 'rgba(139, 92, 246, 0.28)',
      disabled: 'rgba(148, 163, 184, 0.7)',
      disabledBackground: 'rgba(30, 41, 59, 0.5)',
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
