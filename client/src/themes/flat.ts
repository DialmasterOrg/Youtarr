import React from 'react';
import { Box } from '@mui/material';
import { ThemeDefinition } from './types';
import { fabBase } from './shared';

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
      'font-display': "'Plus Jakarta Sans'",
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
      'nav-radius': '8px',
      'action-bar-gap': '6px',
      'action-bar-gap-compact': '6px',
      'action-bar-padding-y': '8px',
      'action-bar-padding-x': '0px',
      'chip-shadow': 'none',
      'chip-shadow-hover': 'none',
      'rating-chip-shadow': 'none',
      'rating-chip-shadow-hover': 'none',
      'status-chip-max-width': '140px',
      'rating-chip-max-width': '120px',
      'action-bar-foreground': '217 32% 10%',
      'action-bar-border': '210 14% 90%',
      'action-bar-hover-border': '217 92% 52%',
      'action-bar-disabled-foreground': '215 13% 34%',
      'audio-chip-bg': 'transparent',
      'audio-chip-foreground': 'var(--foreground)',
      'audio-chip-icon': 'var(--foreground)',
      'video-chip-bg': 'transparent',
      'video-chip-foreground': 'var(--foreground)',
      'video-chip-icon': 'var(--foreground)',
      'fab-primary-bg': 'var(--primary)',
      'fab-primary-fg': 'var(--primary-foreground)',
      'fab-primary-hover-bg': 'var(--primary)',
      'fab-primary-hover-fg': 'var(--primary-foreground)',
      'fab-secondary-bg': 'var(--secondary)',
      'fab-secondary-fg': 'var(--secondary-foreground)',
      'fab-secondary-hover-bg': 'var(--secondary)',
      'fab-secondary-hover-fg': 'var(--secondary-foreground)',
      'fab-error-bg': 'var(--destructive)',
      'fab-error-fg': 'var(--destructive-foreground)',
      'fab-error-hover-bg': 'var(--destructive)',
      'fab-error-hover-fg': 'var(--destructive-foreground)',
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
      'font-display': "'Plus Jakarta Sans'",
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
      'radius-ui': '2px',
      'radius-input': '4px',
      'radius-thumb': '4px',
      'border-weight': '1px',
      'nav-radius': '2px',
      'action-bar-gap': '6px',
      'action-bar-gap-compact': '6px',
      'action-bar-padding-y': '8px',
      'action-bar-padding-x': '0px',
      'chip-shadow': 'none',
      'chip-shadow-hover': 'none',
      'rating-chip-shadow': 'none',
      'rating-chip-shadow-hover': 'none',
      'status-chip-max-width': '140px',
      'rating-chip-max-width': '120px',
      'action-bar-foreground': '0 0% 100%',
      'action-bar-border': '222 47% 20',
      'action-bar-hover-border': '0 0% 100%',
      'action-bar-disabled-foreground': '215 20% 65%',
      'audio-chip-bg': 'transparent',
      'audio-chip-foreground': 'var(--foreground)',
      'audio-chip-icon': 'var(--foreground)',
      'video-chip-bg': 'transparent',
      'video-chip-foreground': 'var(--foreground)',
      'video-chip-icon': 'var(--foreground)',
      'fab-primary-bg': 'var(--primary)',
      'fab-primary-fg': 'var(--primary-foreground)',
      'fab-primary-hover-bg': 'var(--primary)',
      'fab-primary-hover-fg': 'var(--primary-foreground)',
      'fab-secondary-bg': 'var(--secondary)',
      'fab-secondary-fg': 'var(--secondary-foreground)',
      'fab-secondary-hover-bg': 'var(--secondary)',
      'fab-secondary-hover-fg': 'var(--secondary-foreground)',
      'fab-error-bg': 'var(--destructive)',
      'fab-error-fg': 'var(--destructive-foreground)',
      'fab-error-hover-bg': 'var(--destructive)',
      'fab-error-hover-fg': 'var(--destructive-foreground)',
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
          border: 'var(--border-weight) solid var(--border)',
          boxShadow: 'none',
          backgroundColor: 'transparent',
          color: 'var(--foreground)',
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: '0.65rem',
          letterSpacing: '0.05em',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: 'var(--primary)',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
          },
        },
        filledPrimary: {
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          borderColor: 'var(--primary)',
          '&:hover': {
            filter: 'brightness(1.1)',
            backgroundColor: 'var(--primary)',
          },
        },
        filledSuccess: {
          backgroundColor: 'var(--secondary)',
          color: '#FFFFFF',
          borderColor: 'var(--secondary)',
          '&:hover': {
            backgroundColor: 'var(--secondary)',
            filter: 'brightness(1.1)',
            borderColor: 'var(--secondary)',
          },
        },
        outlinedSuccess: {
          color: 'var(--secondary)',
          border: 'var(--border-weight) solid var(--secondary)',
          backgroundColor: 'transparent',
        },
        filledWarning: {
          backgroundColor: 'var(--accent)',
          color: '#000000',
          borderColor: 'var(--accent)',
          '&:hover': {
            backgroundColor: 'var(--accent)',
            filter: 'brightness(1.1)',
            borderColor: 'var(--accent)',
          },
        },
        filledError: {
          backgroundColor: 'var(--destructive)',
          color: '#FFFFFF',
          borderColor: 'var(--destructive)',
          '&:hover': {
            backgroundColor: 'var(--destructive)',
            filter: 'brightness(1.1)',
            borderColor: 'var(--destructive)',
          },
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
          textTransform: 'uppercase',
          fontWeight: 700,
          fontFamily: 'var(--font-body)',
          fontSize: '0.75rem',
          letterSpacing: '0.05em',
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid transparent',
          boxShadow: 'none',
          transition: 'all 200ms ease',
          '&:hover': {
            boxShadow: 'none',
            transform: 'translateY(-1px)',
            borderColor: 'var(--primary)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        containedPrimary: {
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          '&:hover': {
            backgroundColor: 'var(--primary)',
            filter: 'brightness(1.1)',
          },
        },
        outlinedPrimary: {
          borderWidth: 'var(--border-weight)',
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
          borderWidth: 'var(--border-weight)',
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
          borderWidth: 'var(--border-weight)',
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
          borderWidth: 'var(--border-weight)',
          '&:hover': {
            backgroundColor: 'var(--foreground)',
            color: 'var(--background)',
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
        root: {
          '&.Mui-primary': {
            backgroundColor: 'var(--fab-primary-bg)',
            color: 'var(--fab-primary-fg)',
            boxShadow: 'none',
            border: '2px solid var(--primary)',
            transition: 'transform 200ms ease, background-color 200ms ease, border-color 200ms ease',
            '&:hover': {
              backgroundColor: 'var(--fab-primary-hover-bg)',
              color: 'var(--fab-primary-hover-fg)',
              borderColor: 'var(--primary)',
              transform: 'scale(1.08)',
              boxShadow: 'none',
              '& .MuiSvgIcon-root': {
                color: 'inherit',
              },
            },
          },
          '&.Mui-secondary': {
            backgroundColor: 'var(--fab-secondary-bg)',
            color: 'var(--fab-secondary-fg)',
            border: '2px solid var(--secondary)',
            '&:hover': {
              backgroundColor: 'var(--fab-secondary-hover-bg)',
              color: 'var(--fab-secondary-hover-fg)',
              borderColor: 'var(--secondary)',
              '& .MuiSvgIcon-root': {
                color: 'inherit',
              },
            },
          },
          '&.Mui-error': {
            backgroundColor: 'var(--fab-error-bg)',
            color: 'var(--fab-error-fg)',
            border: '2px solid var(--destructive)',
            '&:hover': {
              backgroundColor: 'var(--fab-error-hover-bg)',
              color: 'var(--fab-error-hover-fg)',
              borderColor: 'var(--destructive)',
              '& .MuiSvgIcon-root': {
                color: 'inherit',
              },
            },
          },
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


