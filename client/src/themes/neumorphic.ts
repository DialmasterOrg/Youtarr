import React from 'react';
import { Box } from '@mui/material';
import { ThemeDefinition } from './types';

export const neumorphicTheme: ThemeDefinition = {
  id: 'neumorphic',
  name: 'Neumorphic (Soft)',
  description: 'Soft UI with inner and outer shadows for a tactile feel.',
  layoutMode: 'top-nav',
  preview: React.createElement(Box, {
    key: 'preview-root',
    sx: {
      p: 2.5,
      borderRadius: 3,
      bgcolor: '#e0e5ec',
      boxShadow: '9px 9px 16px rgba(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minHeight: 80,
    }
  }, [
    React.createElement(Box, {
      key: 'b1',
      sx: {
        width: 44,
        height: 44,
        borderRadius: '999px',
        boxShadow: 'inset 6px 6px 10px rgba(163, 177, 198, 0.6), inset -6px -6px 10px rgba(255, 255, 255, 0.5)',
      }
    }),
    React.createElement(Box, {
      key: 'b2',
      sx: {
        width: 90,
        height: 16,
        borderRadius: '999px',
        boxShadow: '9px 9px 16px rgba(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)',
      }
    })
  ]),
  tokens: {
    light: {
      'font-body': "'DM Sans'",
      'font-display': "'DM Sans'",
      background: '210 20% 90%',
      foreground: '210 10% 20%',
      card: '210 20% 90%',
      'card-foreground': '210 10% 20%',
      popover: '210 20% 90%',
      'popover-foreground': '210 10% 20%',
      primary: '210 20% 20%',
      'primary-foreground': '210 20% 98%',
      secondary: '210 10% 85%',
      'secondary-foreground': '210 10% 20%',
      muted: '210 10% 88%',
      'muted-foreground': '210 10% 45%',
      accent: '210 20% 85%',
      'accent-foreground': '210 10% 20%',
      destructive: '0 80% 60%',
      'destructive-foreground': '210 20% 98%',
      border: '210 10% 85%',
      'border-strong': '210 10% 80%',
      input: '210 20% 90%',
      'input-border': 'transparent',
      'input-border-hover': 'transparent',
      ring: '210 20% 20%',
      radius: '2rem',
      'radius-ui': '16px',
      'radius-input': '16px',
      'radius-thumb': '16px',
      'border-weight': '0px',
      'nav-radius': '16px',
      'action-bar-gap': '8px',
      'action-bar-gap-compact': '6px',
      'action-bar-padding-y': '8px',
      'action-bar-padding-x': '0px',
      'action-bar-foreground': '210 10% 20%',
      'action-bar-border': '210 10% 85%',
      'action-bar-hover-border': '210 10% 80%',
      'action-bar-disabled-foreground': '210 10% 45%',
      'audio-chip-radius': 'var(--radius-ui)',
      'audio-chip-bg': 'var(--card)',
      'audio-chip-border': 'transparent',
      'audio-chip-foreground': 'var(--foreground)',
      'audio-chip-icon': 'var(--primary)',
      'audio-chip-shadow': 'var(--shadow-soft)',
      'audio-chip-shadow-hover': 'var(--shadow-hard)',
      'video-chip-radius': 'var(--radius-ui)',
      'video-chip-bg': 'var(--card)',
      'video-chip-border': 'transparent',
      'video-chip-foreground': 'var(--foreground)',
      'video-chip-icon': 'var(--primary)',
      'video-chip-shadow': 'var(--shadow-soft)',
      'video-chip-shadow-hover': 'var(--shadow-hard)',
      'audio-control-radius': 'var(--radius-ui)',
      'audio-control-border': 'transparent',
      'audio-control-bg': 'var(--input)',
      'audio-control-foreground': 'var(--foreground)',
      'audio-control-shadow': 'var(--shadow-input-rest)',
      'audio-control-shadow-focus': 'var(--shadow-input-focus)',
      'nav-hover-style': 'inset-glow',
      shadow: '0 0% 0%',
      'shadow-soft': '8px 8px 16px #bebebe, -8px -8px 16px #ffffff',
      'shadow-hard': '12px 12px 24px #bebebe, -12px -12px 24px #ffffff',
      'shadow-hard-hover': '16px 16px 32px #bebebe, -16px -16px 32px #ffffff',
      'shadow-hard-active': '4px 4px 8px #bebebe, -4px -4px 8px #ffffff',
      'transition-bouncy': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      'card-hover-transform': 'scale(1.02)',
      'card-hover-shadow': '20px 20px 60px #bebebe, -20px -20px 60px #ffffff',
      'shadow-input-rest': 'inset 4px 4px 8px #bebebe, inset -4px -4px 8px #ffffff',
      'shadow-input-focus': 'inset 6px 6px 12px #bebebe, inset -6px -6px 12px #ffffff',
    },
    dark: {
      'font-body': "'DM Sans'",
      'font-display': "'DM Sans'",
      background: '210 20% 10%',
      foreground: '210 10% 90%',
      card: '210 20% 10%',
      'card-foreground': '210 10% 90%',
      popover: '210 20% 10%',
      'popover-foreground': '210 10% 90%',
      primary: '210 20% 90%',
      'primary-foreground': '210 20% 10%',
      secondary: '210 10% 15%',
      'secondary-foreground': '210 10% 90%',
      muted: '210 10% 12%',
      'muted-foreground': '210 10% 60%',
      accent: '210 20% 15%',
      'accent-foreground': '210 10% 90%',
      destructive: '0 60% 40%',
      'destructive-foreground': '210 20% 98%',
      border: '210 10% 15%',
      'border-strong': '210 10% 20%',
      input: '210 20% 10%',
      'input-border': 'transparent',
      'input-border-hover': 'transparent',
      ring: '210 20% 90%',
      radius: '2rem',
      'radius-ui': '16px',
      'radius-input': '16px',
      'radius-thumb': '16px',
      'border-weight': '0px',
      'nav-radius': '16px',
      'action-bar-gap': '8px',
      'action-bar-gap-compact': '6px',
      'action-bar-padding-y': '8px',
      'action-bar-padding-x': '0px',
      'action-bar-foreground': '210 10% 90%',
      'action-bar-border': '210 10% 15%',
      'action-bar-hover-border': '210 10% 20%',
      'action-bar-disabled-foreground': '210 10% 60%',
      'audio-chip-radius': 'var(--radius-ui)',
      'audio-chip-bg': 'var(--card)',
      'audio-chip-border': 'transparent',
      'audio-chip-foreground': 'var(--foreground)',
      'audio-chip-icon': 'var(--primary)',
      'audio-chip-shadow': 'var(--shadow-soft)',
      'audio-chip-shadow-hover': 'var(--shadow-hard)',
      'video-chip-radius': 'var(--radius-ui)',
      'video-chip-bg': 'var(--card)',
      'video-chip-border': 'transparent',
      'video-chip-foreground': 'var(--foreground)',
      'video-chip-icon': 'var(--primary)',
      'video-chip-shadow': 'var(--shadow-soft)',
      'video-chip-shadow-hover': 'var(--shadow-hard)',
      'audio-control-radius': 'var(--radius-ui)',
      'audio-control-border': 'transparent',
      'audio-control-bg': 'var(--input)',
      'audio-control-foreground': 'var(--foreground)',
      'audio-control-shadow': 'var(--shadow-input-rest)',
      'audio-control-shadow-focus': 'var(--shadow-input-focus)',
      /* Chip & rating shadows */
      'chip-shadow': 'var(--shadow-input-rest)',
      'chip-shadow-hover': 'var(--shadow-input-rest)',
      'rating-chip-shadow': 'var(--shadow-input-rest)',
      'rating-chip-shadow-hover': 'var(--shadow-input-rest)',
      'status-chip-max-width': '140px',
      'rating-chip-max-width': '120px',
      'nav-hover-style': 'inset-glow',
      shadow: '0 0% 0%',
      'shadow-soft': '8px 8px 16px #0a0a0a, -8px -8px 16px #1e1e1e',
      'shadow-hard': '12px 12px 24px #0a0a0a, -12px -12px 24px #1e1e1e',
      'shadow-hard-hover': '16px 16px 32px #0a0a0a, -16px -16px 32px #1e1e1e',
      'shadow-hard-active': '4px 4px 8px #0a0a0a, -4px -4px 8px #1e1e1e',
      'transition-bouncy': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      'card-hover-transform': 'scale(1.02)',
      'card-hover-shadow': '20px 20px 60px #0a0a0a, -20px -20px 60px #1e1e1e',
      'shadow-input-rest': 'inset 4px 4px 8px #0a0a0a, inset -4px -4px 8px #1e1e1e',
      'shadow-input-focus': 'inset 6px 6px 12px #0a0a0a, inset -6px -6px 12px #1e1e1e',
    },
  },
  muiOverrides: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          boxShadow: 'var(--shadow-soft)',
          backgroundColor: 'var(--card)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          boxShadow: 'var(--shadow-soft)',
          '&:hover': {
            transform: 'var(--card-hover-transform)',
            boxShadow: 'var(--card-hover-shadow)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          backgroundColor: 'hsl(var(--background))',
          boxShadow: 'var(--shadow-soft)',
          color: 'var(--foreground)',
          fontWeight: 700,
          transition: 'all 0.3s ease',
        },
        filledPrimary: {
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          boxShadow: 'var(--shadow-input-rest)',
        },
        filledSuccess: {
          backgroundColor: 'hsl(var(--background))',
          color: 'var(--secondary)',
          boxShadow: 'var(--shadow-input-rest)',
        },
        outlinedSuccess: {
          color: 'var(--secondary)',
          boxShadow: 'var(--shadow-soft)',
        },
        filledWarning: {
          backgroundColor: 'hsl(var(--background))',
          color: 'var(--accent)',
          boxShadow: 'var(--shadow-input-rest)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: '#E0E5EC',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'transparent',
          },
          boxShadow:
            'inset 6px 6px 10px rgba(163, 177, 198, 0.6), inset -6px -6px 10px rgba(255, 255, 255, 0.5)',
          '&.Mui-focused': {
            boxShadow:
              'inset 10px 10px 20px rgba(163, 177, 198, 0.7), inset -10px -10px 20px rgba(255, 255, 255, 0.6), 0 0 0 2px rgba(108, 99, 255, 0.35)',
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: '#6C63FF',
            '& + .MuiSwitch-track': {
              backgroundColor: '#E0E5EC',
              opacity: 1,
              boxShadow:
                'inset 3px 3px 6px rgba(163, 177, 198, 0.6), inset -3px -3px 6px rgba(255, 255, 255, 0.5)',
            },
          },
        },
        track: {
          backgroundColor: '#E0E5EC',
          opacity: 1,
          boxShadow:
            'inset 3px 3px 6px rgba(163, 177, 198, 0.6), inset -3px -3px 6px rgba(255, 255, 255, 0.5)',
        },
        thumb: {
          boxShadow: '5px 5px 10px rgba(163, 177, 198, 0.6), -5px -5px 10px rgba(255, 255, 255, 0.5)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          boxShadow: 'var(--shadow-soft)',
          backgroundColor: 'var(--background)',
          color: 'var(--foreground)',
          textTransform: 'none',
          fontWeight: 700,
          transition: 'all 300ms var(--transition-bouncy)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 'var(--shadow-hard)',
            backgroundColor: 'var(--background)',
          },
          '&:active': {
            transform: 'translateY(1px)',
            boxShadow: 'var(--shadow-input-rest)',
          },
        },
        outlined: {
          border: 'none',
          backgroundColor: 'var(--background)',
          color: 'var(--foreground)',
          boxShadow: 'var(--shadow-soft)',
          '&:hover': {
            boxShadow: 'var(--shadow-hard)',
            backgroundColor: 'var(--background)',
            color: 'var(--primary)',
          },
        },
        outlinedPrimary: {
          color: 'var(--primary)',
          '&:hover': {
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            boxShadow: 'var(--shadow-hard)',
          },
          '&.Mui-disabled': {
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        outlinedWarning: {
          color: 'var(--accent)',
          '&:hover': {
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-foreground)',
            boxShadow: 'var(--shadow-hard)',
          },
          '&.Mui-disabled': {
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        outlinedError: {
          color: 'var(--destructive)',
          '&:hover': {
            backgroundColor: 'var(--destructive)',
            color: 'var(--destructive-foreground)',
            boxShadow: 'var(--shadow-hard)',
          },
          '&.Mui-disabled': {
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: '#3D4852',
          backgroundColor: '#E0E5EC',
          boxShadow: '6px 6px 12px rgba(163, 177, 198, 0.4), -6px -6px 12px rgba(255, 255, 255, 0.3)',
          border: 'none',
          transition: 'all 300ms ease-out',
          '&:hover': {
            backgroundColor: '#E0E5EC',
            boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.5), -8px -8px 16px rgba(255, 255, 255, 0.4)',
          },
          '&.Mui-selected': {
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            boxShadow: '8px 8px 16px rgba(163, 177, 198, 0.5), -8px -8px 16px rgba(255, 255, 255, 0.4)',
            '&:hover': {
              backgroundColor: '#059669',
              boxShadow: '10px 10px 20px rgba(163, 177, 198, 0.6), -10px -10px 20px rgba(255, 255, 255, 0.5)',
            },
          },
        },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          color: '#3D4852',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: '#E0E5EC',
          borderRadius: 'var(--radius-ui)',
          boxShadow: 'inset 2px 2px 5px rgba(163, 177, 198, 0.6), inset -2px -2px 5px rgba(255, 255, 255, 0.5)',
          overflow: 'hidden',
          height: 10,
        },
        bar: {
          backgroundColor: '#8B5CF6',
          borderRadius: 'var(--radius-ui)',
          boxShadow: '3px 3px 6px rgba(163, 177, 198, 0.4)',
        },
      },
    },
  },
};
