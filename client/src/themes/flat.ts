import React from 'react';
import { Box } from '@mui/material';
import { ThemeDefinition } from './types';

export const flatTheme: ThemeDefinition = {
  id: 'flat',
  name: 'Bold Flat',
  description: 'Zero depth, bold colors, and geometric precision. No shadows, pure flat design with color as structure.',
  layoutMode: 'top-nav',
  preview: React.createElement(Box, {
    key: 'preview-root',
    sx: {
      p: 2.5,
      borderRadius: '8px',
      bgcolor: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      position: 'relative',
      border: '2px solid #E5E7EB',
      width: '100%',
      minHeight: 80,
    }
  }, [
    React.createElement(Box, {
      key: 'b1',
      sx: {
        width: 44,
        height: 44,
        borderRadius: '50%',
        bgcolor: '#3B82F6',
        border: '2px solid #111827',
      }
    }),
    React.createElement(Box, {
      key: 'b2',
      sx: { width: 90, height: 16, borderRadius: '6px', bgcolor: '#F3F4F6', border: '2px solid #111827' }
    })
  ]),
  tokens: {
    light: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Outfit'",
      background: '0 0% 100%', // Pure White
      foreground: '217 32% 10%', // Dark Gray 900 (#111827)
      card: '0 0% 100%',
      'card-foreground': '217 32% 10%',
      popover: '0 0% 100%',
      'popover-foreground': '217 32% 10%',
      primary: '217 92% 52%', // #3B82F6 - Bold Blue
      'primary-foreground': '210 40% 98%', // White
      secondary: '160 84% 39%', // #10B981 - Emerald
      'secondary-foreground': '0 0% 100%',
      muted: '210 40% 96.1%', // #F3F4F6 - Gray 100
      'muted-foreground': '215 13% 34%', // Gray 600
      accent: '38 92% 50%', // #F59E0B - Amber
      'accent-foreground': '0 0% 100%',
      destructive: '0 84% 60%', // Red
      'destructive-foreground': '0 0% 100%',
      border: '210 14% 90%', // #E5E7EB - Gray 200
      'border-strong': '217 32% 10%', // Dark Gray
      input: '210 40% 96%', // #F3F4F6 - Gray 100
      'input-border': '210 14% 90%', // Gray 200
      'input-border-hover': '217 92% 52%', // Primary Blue
      ring: '217 92% 52%', // Primary Blue
      radius: '0.25rem',
      'radius-ui': '8px', // 8px for consistency
      'radius-input': '8px',
      'radius-thumb': '8px',
      'border-weight': '2px',
      'nav-hover-style': 'flat-solid',
      'shadow-soft': 'none',
      'shadow-hard': 'none',
      'shadow-hard-hover': 'none',
      'transition-smooth': 'all 0.2s ease',
    },
    dark: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Outfit'",
      background: '0 0% 100%', // Light mode only
      foreground: '217 32% 10%',
      card: '0 0% 100%',
      'card-foreground': '217 32% 10%',
      popover: '0 0% 100%',
      'popover-foreground': '217 32% 10%',
      primary: '217 92% 52%',
      'primary-foreground': '210 40% 98%',
      secondary: '160 84% 39%',
      'secondary-foreground': '0 0% 100%',
      muted: '210 40% 96.1%',
      'muted-foreground': '215 13% 34%',
      accent: '38 92% 50%',
      'accent-foreground': '0 0% 100%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 100%',
      border: '210 14% 90%',
      'border-strong': '217 32% 10%',
      input: '210 40% 96%',
      'input-border': '210 14% 90%',
      'input-border-hover': '217 92% 52%',
      ring: '217 92% 52%',
      radius: '0.25rem',
      'radius-ui': '8px',
      'radius-input': '8px',
      'radius-thumb': '8px',
      'border-weight': '2px',
      'nav-hover-style': 'flat-solid',
      'shadow-soft': 'none',
      'shadow-hard': 'none',
      'shadow-hard-hover': 'none',
      'transition-smooth': 'all 0.2s ease',
    },
  },
  muiOverrides: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid var(--border)',
          boxShadow: 'none',
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          boxShadow: 'none',
          backgroundColor: '#FFFFFF',
          transition: 'transform 200ms ease, background-color 200ms ease',
          '&:hover': {
            transform: 'scale(1.02)',
            backgroundColor: '#F3F4F6',
            boxShadow: 'none',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          boxShadow: 'none',
          backgroundColor: '#F3F4F6',
          color: '#111827',
          fontWeight: 600,
        },
        filledSuccess: {
          backgroundColor: '#10B981',
          color: '#FFFFFF',
        },
        filledInfo: {
          backgroundColor: '#3B82F6',
          color: '#FFFFFF',
        },
        filledWarning: {
          backgroundColor: '#F59E0B',
          color: '#FFFFFF',
        },
        filledError: {
          backgroundColor: '#EF4444',
          color: '#FFFFFF',
        },
        outlinedSuccess: {
          color: '#10B981',
          border: '2px solid #10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
        },
        outlinedInfo: {
          color: '#3B82F6',
          border: '2px solid #3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
        },
        outlinedWarning: {
          color: '#F59E0B',
          border: '2px solid #F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-input)',
          backgroundColor: '#F3F4F6',
          color: '#111827',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'transparent',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#E5E7EB',
          },
          '&.Mui-focused': {
            backgroundColor: '#FFFFFF',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3B82F6',
            borderWidth: 2,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: '#111827',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: '#3B82F6',
            '& + .MuiSwitch-track': {
              backgroundColor: '#3B82F6',
              opacity: 1,
            },
          },
        },
        track: {
          backgroundColor: '#E5E7EB',
          opacity: 1,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          boxShadow: 'none',
          transition: 'transform 200ms ease, background-color 200ms ease, border-color 200ms ease',
          '&:hover': {
            boxShadow: 'none',
            transform: 'scale(1.05)',
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
        },
        containedPrimary: {
          backgroundColor: '#3B82F6',
          color: '#FFFFFF',
          '&:hover': {
            backgroundColor: '#2563EB',
          },
        },
        outlinedPrimary: {
          borderWidth: '2px',
          borderColor: '#3B82F6',
          color: '#3B82F6',
          '&:hover': {
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            borderColor: '#3B82F6',
          },
        },
        outlined: {
          color: '#111827',
          borderColor: '#E5E7EB',
          borderWidth: '2px',
          '&:hover': {
            backgroundColor: '#F3F4F6',
            borderColor: '#3B82F6',
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: '#111827',
          borderColor: '#E5E7EB',
          backgroundColor: 'transparent',
          borderWidth: '2px',
          transition: 'all 200ms ease',
          '&:hover': {
            backgroundColor: '#F3F4F6',
            borderColor: '#3B82F6',
            color: '#3B82F6',
          },
          '&.Mui-selected': {
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            borderColor: '#3B82F6',
            '&:hover': {
              backgroundColor: '#2563EB',
              borderColor: '#2563EB',
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'transform 200ms ease, background-color 200ms ease',
          '&:hover': {
            transform: 'scale(1.08)',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        primary: {
          backgroundColor: '#3B82F6',
          color: '#FFFFFF',
          boxShadow: 'none',
          border: '2px solid #3B82F6',
          transition: 'transform 200ms ease, background-color 200ms ease, border-color 200ms ease',
          '&:hover': {
            backgroundColor: '#2563EB',
            borderColor: '#2563EB',
            transform: 'scale(1.08)',
            boxShadow: 'none',
          },
        },
      },
    },
  },
};


