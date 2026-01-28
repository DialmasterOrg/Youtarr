import React from 'react';
import { Box } from '@mui/material';
import { ThemeDefinition } from './types';

export const playfulTheme: ThemeDefinition = {
  id: 'playful',
  name: 'Playful (Classic)',
  description: 'Bold colors, rounded corners, and expressive shadows.',
  layoutMode: 'sidebar',
  preview: React.createElement(Box, {
    sx: {
      p: 2.5,
      borderRadius: 3,
      bgcolor: '#fffdf5',
      border: '2px solid #1e293b',
      boxShadow: '4px 4px 0px 0px #1e293b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minHeight: 80,
    }
  }, [
    React.createElement(Box, { key: 'b1', sx: { width: 44, height: 44, borderRadius: 1.5, bgcolor: '#f472b6', border: '2px solid #1e293b' } }),
    React.createElement(Box, { key: 'b2', sx: { width: 90, height: 16, borderRadius: 999, bgcolor: '#fbbf24', border: '2px solid #1e293b' } })
  ]),
  tokens: {
    light: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Outfit'",
      background: '48 100% 98%', // #fffdf5
      foreground: '222 47% 11%', // #1e293b
      card: '0 0% 100%',
      'card-foreground': '222 47% 11%',
      popover: '0 0% 100%',
      'popover-foreground': '222 47% 11%',
      primary: '262 83% 58%', // #8b5cf6
      'primary-foreground': '0 0% 100%',
      secondary: '340 82% 70%', // #f472b6
      muted: '210 40% 96%', // #f1f5f9
      'muted-foreground': '215 16% 47%', // #64748b
      accent: '210 40% 96%',
      'accent-foreground': '222 47% 11%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      border: '214 32% 91%', // #e2e8f0
      'border-strong': '222 47% 11%',
      input: '0 0% 100%',
      'input-border': '214 32% 91%',
      'input-border-hover': '222 47% 11%',
      ring: '262 83% 58%',
      radius: '1.25rem',
      'radius-ui': '24px',
      'radius-input': '16px',
      'radius-thumb': '16px',
      'border-weight': '2px',
      'nav-hover-style': 'hard-shadow',
      shadow: '222 47% 11%',
      'shadow-soft': '8px 8px 0px 0px #e2e8f0',
      'shadow-hard': '4px 4px 0px 0px #1e293b',
      'shadow-hard-hover': '6px 6px 0px 0px #1e293b',
      'shadow-hard-active': '2px 2px 0px 0px #1e293b',
      'transition-bouncy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      'card-hover-transform': 'translate(-2px, -2px) rotate(-0.5deg)',
      'card-hover-shadow': 'var(--shadow-hard-hover)',
      'shadow-input-rest': 'none',
      'shadow-input-focus': '0 0 0 2px var(--ring)',
      'dot-grid': 'rgba(30, 41, 59, 0.12)',
      'nav-border': '2px solid var(--foreground)',
      'nav-shadow': 'var(--shadow-hard)',
      'nav-item-bg-selected': '#fbbf24', // tertiary in playful
      'nav-item-text-selected': '#1e293b',
      'appbar-border': '2px solid var(--foreground)',
      'appbar-shadow': 'var(--shadow-hard)',
    },
    dark: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Outfit'",
      background: '222 47% 11%', // #0f172a
      foreground: '48 100% 98%', // #fffdf5
      card: '222 47% 11%',
      'card-foreground': '48 100% 98%',
      popover: '222 47% 11%',
      'popover-foreground': '48 100% 98%',
      primary: '258 90% 66%', // #8b5cf6
      'primary-foreground': '222 47% 11%',
      secondary: '340 82% 70%',
      muted: '222 47% 20%',
      'muted-foreground': '215 16% 70%',
      accent: '222 47% 20%',
      'accent-foreground': '48 100% 98%',
      destructive: '0 84% 40%',
      'destructive-foreground': '0 0% 100%',
      border: '222 47% 25%',
      'border-strong': '48 100% 98%',
      input: '222 47% 11%',
      'input-border': '222 47% 25%',
      'input-border-hover': '48 100% 98%',
      ring: '258 90% 66%',
      radius: '1.25rem',
      'radius-ui': '24px',
      'radius-input': '16px',
      'radius-thumb': '16px',
      'border-weight': '2px',
      'nav-hover-style': 'hard-shadow',
      shadow: '48 100% 98%',
      'shadow-soft': '8px 8px 0px 0px rgba(0,0,0,0.3)',
      'shadow-hard': '4px 4px 0px 0px #fffdf5',
      'shadow-hard-hover': '6px 6px 0px 0px #fffdf5',
      'shadow-hard-active': '2px 2px 0px 0px #fffdf5',
      'transition-bouncy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      'card-hover-transform': 'translate(-2px, -2px) rotate(-0.5deg)',
      'card-hover-shadow': 'var(--shadow-hard-hover)',
      'shadow-input-rest': 'none',
      'shadow-input-focus': '0 0 0 2px var(--ring)',
      'dot-grid': 'rgba(255, 255, 255, 0.1)',
      'nav-border': '2px solid var(--foreground)',
      'nav-shadow': 'var(--shadow-hard)',
      'nav-item-bg-selected': '#fbbf24',
      'nav-item-text-selected': '#1e293b',
      'appbar-border': '2px solid var(--foreground)',
      'appbar-shadow': 'var(--shadow-hard)',
    },
  },
  muiOverrides: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid var(--border)',
          boxShadow: 'var(--shadow-hard)',
          transition: 'all 300ms var(--transition-bouncy)',
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
          borderRadius: 'var(--radius-ui)',
          textTransform: 'none',
          fontWeight: 700,
          border: '2px solid transparent',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          border: '2px solid var(--foreground)',
          boxShadow: 'var(--shadow-hard)',
          '&:hover': {
            transform: 'translate(-2px, -2px)',
            boxShadow: 'var(--shadow-hard-hover)',
          },
          '&:active': {
            transform: 'translate(0, 0)',
            boxShadow: 'var(--shadow-hard-active)',
          },
        },
        outlined: {
          border: '2px solid var(--foreground)',
          color: 'var(--foreground)',
          '&:hover': {
            backgroundColor: 'var(--foreground)',
            color: 'var(--background)',
          },
        },
        outlinedPrimary: {
          color: 'var(--primary)',
          borderColor: 'var(--primary)',
          '&:hover': {
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            borderColor: 'var(--foreground)',
          },
          '&.Mui-disabled': {
            borderColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        outlinedWarning: {
          color: '#fbbf24', // Amber coloring for playful warning
          borderColor: '#fbbf24',
          '&:hover': {
            backgroundColor: '#fbbf24',
            color: 'var(--background)',
            borderColor: 'var(--foreground)',
          },
          '&.Mui-disabled': {
            borderColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        outlinedError: {
          color: 'var(--destructive)',
          borderColor: 'var(--destructive)',
          '&:hover': {
            backgroundColor: 'var(--destructive)',
            color: 'var(--destructive-foreground)',
            borderColor: 'var(--foreground)',
          },
          '&.Mui-disabled': {
            borderColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: '2px solid var(--foreground)',
          fontWeight: 700,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
          borderRadius: 'var(--radius-ui)',
          border: '1.5px solid #1e293b',
          overflow: 'hidden',
          height: 10,
        },
        bar: {
          backgroundColor: '#f472b6',
          borderRadius: 'var(--radius-ui)',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        primary: {
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          border: '2px solid var(--foreground)',
          boxShadow: 'var(--shadow-hard)',
          transition: 'all 300ms var(--transition-bouncy)',
          '&:hover': {
            backgroundColor: 'var(--primary-foreground)',
            color: 'var(--primary)',
            transform: 'translate(-2px, -2px) scale(1.05)',
            boxShadow: 'var(--shadow-hard-hover)',
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
          },
          '&:active': {
            transform: 'translate(0, 0)',
            boxShadow: 'var(--shadow-hard-active)',
          },
        },
        secondary: {
          backgroundColor: 'var(--secondary)',
          color: 'var(--primary-foreground)',
          border: '2px solid var(--foreground)',
          boxShadow: 'var(--shadow-hard)',
          transition: 'all 300ms var(--transition-bouncy)',
          '&:hover': {
            backgroundColor: 'var(--primary-foreground)',
            color: 'var(--secondary)',
            transform: 'translate(-2px, -2px) scale(1.05)',
            boxShadow: 'var(--shadow-hard-hover)',
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
          },
          '&:active': {
            transform: 'translate(0, 0)',
            boxShadow: 'var(--shadow-hard-active)',
          },
        },
        error: {
          backgroundColor: 'var(--destructive)',
          color: 'var(--destructive-foreground)',
          border: '2px solid var(--foreground)',
          boxShadow: 'var(--shadow-hard)',
          transition: 'all 300ms var(--transition-bouncy)',
          '&:hover': {
            backgroundColor: 'var(--destructive-foreground)',
            color: 'var(--destructive)',
            transform: 'translate(-2px, -2px) scale(1.05)',
            boxShadow: 'var(--shadow-hard-hover)',
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
          },
          '&:active': {
            transform: 'translate(0, 0)',
            boxShadow: 'var(--shadow-hard-active)',
          },
        },
      },
    },
  },
};
