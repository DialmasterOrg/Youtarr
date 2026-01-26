import React from 'react';
import { Box } from '@mui/material';
import { ThemeDefinition } from './types';

export const linearTheme: ThemeDefinition = {
  id: 'linear',
  name: 'Linear (Modern)',
  description: 'Deep atmosphere, precision depth, and ambient lighting pools.',
  layoutMode: 'top-nav',
  preview: React.createElement(Box, {
    key: 'preview-root',
    sx: {
      p: 2,
      borderRadius: 3,
      bgcolor: '#050506',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      position: 'relative',
    }
  }, [
    React.createElement(Box, {
      key: 'b1',
      sx: {
        position: 'absolute',
        top: -10,
        right: -10,
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(94, 106, 210, 0.3) 0%, transparent 70%)',
        filter: 'blur(5px)',
      }
    }),
    React.createElement(Box, {
      key: 'b2',
      sx: { width: 24, height: 24, borderRadius: 1.5, bgcolor: '#5E6AD2', boxShadow: '0 0 15px rgba(94, 106, 210, 0.4)' }
    }),
    React.createElement(Box, {
      key: 'b3',
      sx: { width: 36, height: 8, borderRadius: 999, bgcolor: 'rgba(255, 255, 255, 0.15)' }
    })
  ]),
  tokens: {
    light: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Outfit'",
      background: '240 10% 3.9%', // Dark by default for linear
      foreground: '0 0% 98%',
      card: '240 10% 3.9%',
      'card-foreground': '0 0% 98%',
      popover: '240 10% 3.9%',
      'popover-foreground': '0 0% 98%',
      primary: '235 56% 59%', // #5E6AD2
      'primary-foreground': '0 0% 100%',
      secondary: '240 3.7% 15.9%',
      'secondary-foreground': '0 0% 98%',
      muted: '240 3.7% 15.9%',
      'muted-foreground': '240 5% 64.9%',
      accent: '240 3.7% 15.9%',
      'accent-foreground': '0 0% 98%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '0 0% 98%',
      border: '240 3.7% 15.9%',
      'border-strong': '240 5% 30%',
      input: '240 3.7% 15.9%',
      'input-border': '240 3.7% 15.9%',
      'input-border-hover': '235 56% 59%',
      ring: '235 56% 59%',
      radius: '0.5rem',
      'shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.4)',
      'shadow-hard': '0 12px 48px rgba(0, 0, 0, 0.6)',
      'shadow-hard-hover': '0 16px 64px rgba(0, 0, 0, 0.8)',
      'transition-smooth': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    dark: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Outfit'",
      background: '240 10% 3.9%',
      foreground: '0 0% 98%',
      card: '240 10% 3.9%',
      'card-foreground': '0 0% 98%',
      popover: '240 10% 3.9%',
      'popover-foreground': '0 0% 98%',
      primary: '235 56% 59%',
      'primary-foreground': '0 0% 100%',
      secondary: '240 3.7% 15.9%',
      'secondary-foreground': '0 0% 98%',
      muted: '240 3.7% 15.9%',
      'muted-foreground': '240 5% 64.9%',
      accent: '240 3.7% 15.9%',
      'accent-foreground': '0 0% 98%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '0 0% 98%',
      border: '240 3.7% 15.9%',
      'border-strong': '240 5% 30%',
      input: '240 3.7% 15.9%',
      'input-border': '240 3.7% 15.9%',
      'input-border-hover': '235 56% 59%',
      ring: '235 56% 59%',
      radius: '0.5rem',
      'shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.4)',
      'shadow-hard': '0 12px 48px rgba(0, 0, 0, 0.6)',
      'shadow-hard-hover': '0 16px 64px rgba(0, 0, 0, 0.8)',
      'transition-smooth': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  muiOverrides: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 6,
        },
        containedPrimary: {
          background: 'linear-gradient(180deg, #6E79E2 0%, #5E6AD2 100%)',
          boxShadow: '0 0 20px rgba(94, 106, 210, 0.3)',
        },
      },
    },
  },
};
