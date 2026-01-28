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
      'nav-border': '2px solid #111827',
      'nav-shadow': 'none',
      'nav-item-border': '2px solid #111827',
      'nav-item-border-selected': '2px solid #111827',
      'nav-item-bg': '#FFFFFF',
      'nav-item-bg-selected': '#3B82F6',
      'nav-item-bg-hover': 'rgba(59, 130, 246, 0.08)',
      'nav-item-shadow': 'none',
      'nav-item-shadow-selected': 'none',
      'nav-item-shadow-hover': 'none',
      'nav-item-transform': 'translate(0, 0)',
      'nav-item-transform-hover': 'translate(0, 0)',
      'nav-item-text-selected': '#FFFFFF',
    },
    dark: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Outfit'",
      background: '222 47% 11%',
      foreground: '0 0% 100%',
      card: '222 47% 12%',
      'card-foreground': '0 0% 100%',
      popover: '222 47% 11%',
      'popover-foreground': '0 0% 100%',
      primary: '217 92% 60%',
      'primary-foreground': '0 0% 100%',
      secondary: '160 84% 45%',
      'secondary-foreground': '0 0% 100%',
      muted: '222 47% 18%',
      'muted-foreground': '215 20% 65%',
      accent: '38 92% 55%',
      'accent-foreground': '0 0% 0%',
      destructive: '0 84% 65%',
      'destructive-foreground': '0 0% 100%',
      border: '222 47% 20%',
      'border-strong': '0 0% 100%',
      input: '222 47% 15%',
      'input-border': '222 47% 20%',
      'input-border-hover': '217 92% 60%',
      ring: '217 92% 60%',
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
      'nav-border': '2px solid #FFFFFF',
      'nav-shadow': 'none',
      'nav-item-border': '2px solid #FFFFFF',
      'nav-item-border-selected': '2px solid #FFFFFF',
      'nav-item-bg': '#111827',
      'nav-item-bg-selected': '#3B82F6',
      'nav-item-bg-hover': 'rgba(59, 130, 246, 0.15)',
      'nav-item-shadow': 'none',
      'nav-item-shadow-selected': 'none',
      'nav-item-shadow-hover': 'none',
      'nav-item-transform': 'translate(0, 0)',
      'nav-item-transform-hover': 'translate(0, 0)',
      'nav-item-text-selected': '#FFFFFF',
    },
  },
  muiOverrides: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid var(--border)',
          boxShadow: 'none',
          backgroundColor: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          boxShadow: 'none',
          backgroundColor: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          transition: 'transform 200ms ease, background-color 200ms ease',
          '&:hover': {
            transform: 'scale(1.02)',
            backgroundColor: 'hsl(var(--muted))',
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
          backgroundColor: 'hsl(var(--muted))',
          color: 'hsl(var(--foreground))',
          fontWeight: 600,
        },
        filledSuccess: {
          backgroundColor: 'hsl(var(--secondary))',
          color: 'hsl(var(--secondary-foreground))',
        },
        filledInfo: {
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
        },
        filledWarning: {
          backgroundColor: 'hsl(var(--accent))',
          color: 'hsl(var(--accent-foreground))',
        },
        filledError: {
          backgroundColor: 'hsl(var(--destructive))',
          color: 'hsl(var(--destructive-foreground))',
        },
        outlinedSuccess: {
          color: 'hsl(var(--secondary))',
          border: '2px solid hsl(var(--secondary))',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
        },
        outlinedInfo: {
          color: 'hsl(var(--primary))',
          border: '2px solid hsl(var(--primary))',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
        },
        outlinedWarning: {
          color: 'hsl(var(--accent))',
          border: '2px solid hsl(var(--accent))',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-input)',
          backgroundColor: 'hsl(var(--input))',
          color: 'hsl(var(--foreground))',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'transparent',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'hsl(var(--border))',
          },
          '&.Mui-focused': {
            backgroundColor: 'hsl(var(--card))',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'hsl(var(--primary))',
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
          color: 'hsl(var(--foreground))',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: 'hsl(var(--primary))',
            '& + .MuiSwitch-track': {
              backgroundColor: 'hsl(var(--primary))',
              opacity: 1,
            },
          },
        },
        track: {
          backgroundColor: 'hsl(var(--muted))',
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
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          '&:hover': {
            backgroundColor: 'hsl(var(--primary))',
            filter: 'brightness(0.9)',
          },
        },
        outlinedPrimary: {
          borderWidth: '2px',
          borderColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary))',
          '&:hover': {
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            borderColor: 'hsl(var(--primary))',
          },
          '&.Mui-disabled': {
            borderColor: 'hsl(var(--muted))',
            color: 'hsl(var(--muted-foreground))',
            opacity: 0.5,
          },
        },
        outlinedWarning: {
          borderWidth: '2px',
          borderColor: 'hsl(var(--accent))',
          color: 'hsl(var(--accent))',
          '&:hover': {
            backgroundColor: 'hsl(var(--accent))',
            color: 'hsl(var(--accent-foreground))',
            borderColor: 'hsl(var(--accent))',
          },
          '&.Mui-disabled': {
            borderColor: 'hsl(var(--muted))',
            color: 'hsl(var(--muted-foreground))',
            opacity: 0.5,
          },
        },
        outlinedError: {
          borderWidth: '2px',
          borderColor: 'hsl(var(--destructive))',
          color: 'hsl(var(--destructive))',
          '&:hover': {
            backgroundColor: 'hsl(var(--destructive))',
            color: 'hsl(var(--destructive-foreground))',
            borderColor: 'hsl(var(--destructive))',
          },
          '&.Mui-disabled': {
            borderColor: 'hsl(var(--muted))',
            color: 'hsl(var(--muted-foreground))',
            opacity: 0.5,
          },
        },
        outlined: {
          color: 'hsl(var(--foreground))',
          borderColor: 'hsl(var(--border))',
          borderWidth: '2px',
          '&:hover': {
            backgroundColor: 'hsl(var(--muted))',
            borderColor: 'hsl(var(--primary))',
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: 'hsl(var(--foreground))',
          borderColor: 'hsl(var(--border))',
          backgroundColor: 'transparent',
          borderWidth: '2px',
          transition: 'all 200ms ease',
          '&:hover': {
            backgroundColor: 'hsl(var(--muted))',
            borderColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary))',
          },
          '&.Mui-selected': {
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            borderColor: 'hsl(var(--primary))',
            '&:hover': {
              backgroundColor: 'hsl(var(--primary))',
              filter: 'brightness(0.9)',
              borderColor: 'hsl(var(--primary))',
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: 'hsl(var(--foreground))',
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
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          boxShadow: 'none',
          border: '2px solid hsl(var(--primary))',
          transition: 'transform 200ms ease, background-color 200ms ease, border-color 200ms ease',
          '&:hover': {
            backgroundColor: 'hsl(var(--primary))',
            filter: 'brightness(0.9)',
            borderColor: 'hsl(var(--primary))',
            transform: 'scale(1.08)',
            boxShadow: 'none',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'hsl(var(--muted))',
          borderRadius: 'var(--radius-ui)',
          overflow: 'hidden',
          height: 8,
        },
        bar: {
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: 0,
        },
      },
    },
  },
};


