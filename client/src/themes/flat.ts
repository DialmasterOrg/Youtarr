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
          backgroundColor: 'var(--card)',
          color: 'var(--card-foreground)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          boxShadow: 'none',
          backgroundColor: 'var(--card)',
          color: 'var(--card-foreground)',
          transition: 'transform 200ms ease, background-color 200ms ease',
          '&:hover': {
            transform: 'scale(1.02)',
            backgroundColor: 'var(--muted)',
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
          backgroundColor: 'var(--muted)',
          color: 'var(--foreground)',
          fontWeight: 600,
        },
        filledSuccess: {
          backgroundColor: 'var(--secondary)',
          color: 'var(--secondary-foreground)',
        },
        filledInfo: {
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
        },
        filledWarning: {
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-foreground)',
        },
        filledError: {
          backgroundColor: 'var(--destructive)',
          color: 'var(--destructive-foreground)',
        },
        outlinedSuccess: {
          color: 'var(--secondary)',
          border: '2px solid var(--secondary)',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
        },
        outlinedInfo: {
          color: 'var(--primary)',
          border: '2px solid var(--primary)',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
        },
        outlinedWarning: {
          color: 'var(--accent)',
          border: '2px solid var(--accent)',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-input)',
          backgroundColor: 'var(--input)',
          color: 'var(--foreground)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'transparent',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--border)',
          },
          '&.Mui-focused': {
            backgroundColor: 'var(--card)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--primary)',
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
          color: 'var(--foreground)',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: 'var(--primary)',
            '& + .MuiSwitch-track': {
              backgroundColor: 'var(--primary)',
              opacity: 1,
            },
          },
        },
        track: {
          backgroundColor: 'var(--muted-foreground)',
          opacity: 0.6,
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
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          '&:hover': {
            backgroundColor: 'var(--primary)',
            filter: 'brightness(0.9)',
          },
        },
        outlinedPrimary: {
          borderWidth: '2px',
          borderColor: 'var(--primary)',
          color: 'var(--primary)',
          '&:hover': {
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            borderColor: 'var(--primary)',
          },
          '&.Mui-disabled': {
            borderColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        outlinedWarning: {
          borderWidth: '2px',
          borderColor: 'var(--accent)',
          color: 'var(--accent)',
          '&:hover': {
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-foreground)',
            borderColor: 'var(--accent)',
          },
          '&.Mui-disabled': {
            borderColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        outlinedError: {
          borderWidth: '2px',
          borderColor: 'var(--destructive)',
          color: 'var(--destructive)',
          '&:hover': {
            backgroundColor: 'var(--destructive)',
            color: 'var(--destructive-foreground)',
            borderColor: 'var(--destructive)',
          },
          '&.Mui-disabled': {
            borderColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        outlined: {
          color: 'var(--foreground)',
          borderColor: 'var(--border)',
          borderWidth: '2px',
          '&:hover': {
            backgroundColor: 'var(--muted)',
            borderColor: 'var(--primary)',
            color: 'var(--primary)',
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: 'var(--foreground)',
          borderColor: 'var(--border)',
          backgroundColor: 'transparent',
          borderWidth: '2px',
          transition: 'all 200ms ease',
          '&:hover': {
            backgroundColor: 'var(--muted)',
            borderColor: 'var(--primary)',
            color: 'var(--primary)',
          },
          '&.Mui-selected': {
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            borderColor: 'var(--primary)',
            '&:hover': {
              backgroundColor: 'var(--primary)',
              filter: 'brightness(0.9)',
              borderColor: 'var(--primary)',
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: 'var(--foreground)',
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
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          boxShadow: 'none',
          border: '2px solid var(--primary)',
          transition: 'transform 200ms ease, background-color 200ms ease, border-color 200ms ease',
          '&:hover': {
            backgroundColor: 'var(--primary-foreground)',
            color: 'var(--primary)',
            borderColor: 'var(--primary)',
            transform: 'scale(1.08)',
            boxShadow: 'none',
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
          },
        },
        secondary: {
          backgroundColor: 'var(--secondary)',
          color: 'var(--secondary-foreground)',
          border: '2px solid var(--secondary)',
          '&:hover': {
            backgroundColor: 'var(--secondary-foreground)',
            color: 'var(--secondary)',
            borderColor: 'var(--secondary)',
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
          },
        },
        error: {
          backgroundColor: 'var(--destructive)',
          color: 'var(--destructive-foreground)',
          border: '2px solid var(--destructive)',
          '&:hover': {
            backgroundColor: 'var(--destructive-foreground)',
            color: 'var(--destructive)',
            borderColor: 'var(--destructive)',
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
          '& .MuiSwitch-switchBase': {
            padding: 0,
            margin: 2,
            transitionDuration: '300ms',
            '&.Mui-checked': {
              transform: 'translateX(16px)',
              color: '#fff',
              '& + .MuiSwitch-track': {
                backgroundColor: 'var(--primary)',
                opacity: 1,
                border: 0,
              },
            },
          },
        },
        thumb: {
          boxSizing: 'border-box',
          width: 22,
          height: 22,
        },
        track: {
          borderRadius: 26 / 2,
          backgroundColor: 'var(--muted-foreground)',
          opacity: 0.8,
          transition: 'background-color 500ms',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--muted)',
          borderRadius: 'var(--radius-ui)',
          overflow: 'hidden',
          height: 8,
        },
        bar: {
          backgroundColor: 'var(--primary)',
          borderRadius: 0,
        },
      },
    },
  },
};


