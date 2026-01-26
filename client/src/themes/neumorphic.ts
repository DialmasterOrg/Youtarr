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
      p: 2,
      borderRadius: 3,
      bgcolor: '#e0e5ec',
      boxShadow: '9px 9px 16px rgba(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }
  }, [
    React.createElement(Box, {
      key: 'b1',
      sx: {
        width: 28,
        height: 28,
        borderRadius: '999px',
        boxShadow: 'inset 6px 6px 10px rgba(163, 177, 198, 0.6), inset -6px -6px 10px rgba(255, 255, 255, 0.5)',
      }
    }),
    React.createElement(Box, {
      key: 'b2',
      sx: {
        width: 36,
        height: 36,
        borderRadius: '999px',
        boxShadow: '9px 9px 16px rgba(163, 177, 198, 0.6), -9px -9px 16px rgba(255, 255, 255, 0.5)',
      }
    })
  ]),
  tokens: {
    light: {
      'font-body': "'DM Sans'",
      'font-display': "'Plus Jakarta Sans'",
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
      'font-display': "'Plus Jakarta Sans'",
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
          borderRadius: 32,
          border: 'none',
          boxShadow: 'var(--shadow-soft)',
          backgroundColor: 'hsl(var(--card))',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 32,
          border: 'none',
          boxShadow: 'var(--shadow-soft)',
          '&:hover': {
            transform: 'var(--card-hover-transform)',
            boxShadow: 'var(--card-hover-shadow)',
          },
        },
      },
    },
  },
};
