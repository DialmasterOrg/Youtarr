import React from 'react';
import { Box } from '@mui/material';
import { ThemeDefinition } from './types';

export const flatTheme: ThemeDefinition = {
  id: 'flat',
  name: 'Bold Flat',
  description: 'Zero depth, bold colors, and geometric precision. No shadows.',
  layoutMode: 'top-nav',
  preview: React.createElement(Box, {
    key: 'preview-root',
    sx: {
      p: 2,
      borderRadius: 1.5,
      bgcolor: '#3B82F6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }
  }, [
    React.createElement(Box, { key: 'b1', sx: { width: 24, height: 24, borderRadius: '50%', bgcolor: '#FFFFFF' } }),
    React.createElement(Box, { key: 'b2', sx: { width: 40, height: 10, borderRadius: 1.5, bgcolor: '#FFFFFF', opacity: 0.8 } })
  ]),
  tokens: {
    light: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Outfit'",
      background: '0 0% 100%',
      foreground: '240 10% 3.9%',
      card: '0 0% 100%',
      'card-foreground': '240 10% 3.9%',
      popover: '0 0% 100%',
      'popover-foreground': '240 10% 3.9%',
      primary: '221.2 83.2% 53.3%', // #3B82F6
      'primary-foreground': '210 40% 98%',
      secondary: '210 40% 96.1%',
      'secondary-foreground': '222.2 47.4% 11.2%',
      muted: '210 40% 96.1%',
      'muted-foreground': '215.4 16.3% 46.9%',
      accent: '210 40% 96.1%',
      'accent-foreground': '222.2 47.4% 11.2%',
      destructive: '0 84.2% 60.2%',
      'destructive-foreground': '210 40% 98%',
      border: '214.3 31.8% 91.4%',
      'border-strong': '0 0% 0%',
      input: '214.3 31.8% 91.4%',
      'input-border': '221.2 83.2% 53.3%',
      'input-border-hover': '221.2 83.2% 53.3%',
      ring: '221.2 83.2% 53.3%',
      radius: '0.25rem',
      'shadow-soft': 'none',
      'shadow-hard': 'none',
      'shadow-hard-hover': 'none',
      'radius-ui': '6px',
      'radius-input': '6px',
      'radius-thumb': '6px',
      'border-weight': '2px',
    },
    dark: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Outfit'",
      background: '224 71% 4%',
      foreground: '213 31% 91%',
      card: '224 71% 4%',
      'card-foreground': '213 31% 91%',
      popover: '224 71% 4%',
      'popover-foreground': '213 31% 91%',
      primary: '210 40% 98%',
      'primary-foreground': '222.2 47.4% 1.2%',
      secondary: '222.2 47.4% 11.2%',
      'secondary-foreground': '210 40% 98%',
      muted: '222.2 47.4% 11.2%',
      'muted-foreground': '215.4 16.3% 56.9%',
      accent: '222.2 47.4% 11.2%',
      'accent-foreground': '210 40% 98%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '210 40% 98%',
      border: '216 34% 17%',
      'border-strong': '0 0% 100%',
      input: '216 34% 17%',
      'input-border': '210 40% 98%',
      'input-border-hover': '210 40% 98%',
      ring: '213 27% 84%',
      radius: '0.25rem',
      'radius-ui': '6px',
      'border-weight': '2px',
      'nav-hover-style': 'flat-solid',
      shadow: '0 0% 0%',
      'shadow-soft': 'none',
      'shadow-hard': 'none',
      'shadow-hard-hover': 'none',
    },
  },
  muiOverrides: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid var(--border)',
          boxShadow: 'none',
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
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#F3F4F6',
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
          borderRadius: 0,
          boxShadow: 'none',
          border: 'none',
          transition: 'transform 200ms ease, background-color 200ms ease',
          '&:hover': {
            boxShadow: 'none',
            transform: 'scale(1.05)',
          },
        },
        containedPrimary: {
          backgroundColor: '#3B82F6',
          '&:hover': {
            backgroundColor: '#2563EB',
          },
        },
      },
    },
  },
};
