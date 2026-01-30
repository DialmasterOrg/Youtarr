import React from 'react';
import { Box } from '@mui/material';
import { ThemeDefinition } from './types';

export const linearTheme: ThemeDefinition = {
  id: 'linear',
  name: 'Dark Modern',
  description: 'Deep atmosphere, precision depth, and ambient lighting pools.',
  layoutMode: 'top-nav',
  preview: React.createElement(Box, {
    key: 'preview-root',
    sx: {
      p: 2.5,
      borderRadius: 3,
      bgcolor: '#050506',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      minHeight: 80,
    }
  }, [
    React.createElement(Box, {
      key: 'b1',
      sx: {
        position: 'absolute',
        top: -10,
        right: -10,
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(94, 106, 210, 0.3) 0%, transparent 70%)',
        filter: 'blur(5px)',
      }
    }),
    React.createElement(Box, {
      key: 'b2',
      sx: { width: 44, height: 44, borderRadius: 1.5, bgcolor: '#5E6AD2', boxShadow: '0 0 15px rgba(94, 106, 210, 0.4)' }
    }),
    React.createElement(Box, {
      key: 'b3',
      sx: { width: 90, height: 16, borderRadius: 999, bgcolor: 'rgba(255, 255, 255, 0.15)' }
    })
  ]),
  tokens: {
    light: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Plus Jakarta Sans'",
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
      radius: '0.125rem', // 2px
      'radius-ui': '2px',
      'radius-input': '2px',
      'radius-thumb': '2px',
      'border-weight': '1px',
      'nav-hover-style': 'flat-highlight',
      'shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.4)',
      'shadow-hard': '0 12px 48px rgba(0, 0, 0, 0.6)',
      'shadow-hard-hover': '0 16px 64px rgba(0, 0, 0, 0.8)',
      'transition-smooth': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      'nav-border': '1px solid rgba(255, 255, 255, 0.08)',
      'nav-shadow': '0 12px 40px rgba(0, 0, 0, 0.45)',
      'nav-item-border': '1px solid rgba(255, 255, 255, 0.08)',
      'nav-item-border-selected': '1px solid rgba(94, 106, 210, 0.6)',
      'nav-item-bg': 'rgba(255, 255, 255, 0.02)',
      'nav-item-bg-selected': 'rgba(94, 106, 210, 0.2)',
      'nav-item-bg-hover': 'rgba(255, 255, 255, 0.06)',
      'nav-item-shadow': 'none',
      'nav-item-shadow-selected': '0 8px 24px rgba(0, 0, 0, 0.35)',
      'nav-item-shadow-hover': '0 8px 24px rgba(0, 0, 0, 0.25)',
      'nav-item-transform': 'translate(0, 0)',
      'nav-item-transform-hover': 'translate(0, 0)',
      'nav-item-text-selected': '#F3F4FF',
    },
    dark: {
      'font-body': "'Plus Jakarta Sans'",
      'font-display': "'Plus Jakarta Sans'",
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
      radius: '0.125rem', // 2px
      'radius-ui': '2px',
      'radius-input': '2px',
      'radius-thumb': '2px',
      'border-weight': '1px',
      'nav-hover-style': 'flat-highlight',
      'shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.4)',
      'shadow-hard': '0 12px 48px rgba(0, 0, 0, 0.6)',
      'shadow-hard-hover': '0 16px 64px rgba(0, 0, 0, 0.8)',
      'transition-smooth': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      'nav-border': '1px solid rgba(255, 255, 255, 0.08)',
      'nav-shadow': '0 12px 40px rgba(0, 0, 0, 0.45)',
      'nav-item-border': '1px solid rgba(255, 255, 255, 0.08)',
      'nav-item-border-selected': '1px solid rgba(94, 106, 210, 0.6)',
      'nav-item-bg': 'rgba(255, 255, 255, 0.02)',
      'nav-item-bg-selected': 'rgba(94, 106, 210, 0.2)',
      'nav-item-bg-hover': 'rgba(255, 255, 255, 0.06)',
      'nav-item-shadow': 'none',
      'nav-item-shadow-selected': '0 8px 24px rgba(0, 0, 0, 0.35)',
      'nav-item-shadow-hover': '0 8px 24px rgba(0, 0, 0, 0.25)',
      'nav-item-transform': 'translate(0, 0)',
      'nav-item-transform-hover': 'translate(0, 0)',
      'nav-item-text-selected': '#F3F4FF',
    },
  },
  muiOverrides: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid rgba(255, 255, 255, 0.1)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
          backdropFilter: 'blur(20px)',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.06), 0 2px 20px rgba(0,0,0,0.4), 0 0 40px rgba(0,0,0,0.2)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid var(--border)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.5), 0 0 80px rgba(94,106,210,0.1)',
          transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 240ms ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.1), 0 16px 50px rgba(0,0,0,0.55), 0 0 90px rgba(94,106,210,0.15)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          fontWeight: 600,
        },
        filledSuccess: {
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          color: '#22C55E',
          border: '1px solid #22C55E',
        },
        filledWarning: {
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          color: '#F59E0B',
          border: '1px solid #F59E0B',
        },
        outlinedSuccess: {
          color: '#22C55E',
          border: '1px solid #22C55E',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
        },
        outlinedInfo: {
          color: '#3B82F6',
          border: '1px solid #3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
        },
        outlinedWarning: {
          color: '#F59E0B',
          border: '1px solid #F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          color: '#9CA3AF',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          backgroundColor: 'transparent',
          transition: 'all 200ms ease',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            color: '#E5E7EB',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(94, 106, 210, 0.3)',
            color: '#5E6AD2',
            borderColor: '#5E6AD2',
            '&:hover': {
              backgroundColor: 'rgba(94, 106, 210, 0.4)',
            },
          },
        },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          color: '#E5E7EB',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-input)',
          backgroundColor: '#0F0F12',
          color: '#EDEDEF',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.1)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255,255,255,0.2)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#5E6AD2',
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 2px rgba(94,106,210,0.25)',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#8A8F98',
          fontWeight: 600,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': {
            color: '#5E6AD2',
            '& + .MuiSwitch-track': {
              backgroundColor: 'rgba(94,106,210,0.5)',
              opacity: 1,
            },
          },
        },
        track: {
          backgroundColor: 'rgba(255,255,255,0.12)',
          opacity: 1,
        },
        thumb: {
          boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 'var(--radius-ui)',
          border: 'none',
          boxShadow: 'none',
          transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          },
          '&:active': {
            transform: 'translateY(0px) scale(0.98)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(180deg, #6E79E2 0%, #5E6AD2 100%)',
          boxShadow: '0 0 20px rgba(94, 106, 210, 0.3)',
          '&:hover': {
            background: 'linear-gradient(180deg, #6872D9 0%, #5E6AD2 100%)',
            boxShadow: '0 0 28px rgba(94, 106, 210, 0.45)',
          },
        },
        outlined: {
          color: '#E5E7EB',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          '&:hover': {
            backgroundColor: 'var(--foreground)',
            color: 'var(--background)',
            borderColor: 'var(--foreground)',
          },
        },
        outlinedPrimary: {
          color: '#5E6AD2',
          borderColor: 'rgba(94, 106, 210, 0.5)',
          '&:hover': {
            backgroundColor: 'var(--foreground)',
            color: 'var(--background)',
            borderColor: 'var(--foreground)',
          },
          '&.Mui-disabled': {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.3)',
          },
        },
        outlinedWarning: {
          color: '#F59E0B',
          borderColor: 'rgba(245, 158, 11, 0.5)',
          '&:hover': {
            backgroundColor: 'var(--foreground)',
            color: 'var(--background)',
            borderColor: 'var(--foreground)',
          },
          '&.Mui-disabled': {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.3)',
          },
        },
        outlinedError: {
          color: '#EF4444',
          borderColor: 'rgba(239, 68, 68, 0.5)',
          '&:hover': {
            backgroundColor: 'var(--foreground)',
            color: 'var(--background)',
            borderColor: 'var(--foreground)',
          },
          '&.Mui-disabled': {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.3)',
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        primary: {
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          boxShadow: 'var(--shadow-hard)',
          transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            backgroundColor: 'var(--primary-foreground)',
            color: 'var(--primary)',
            transform: 'translateY(-4px) scale(1.05)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
            border: '2px solid var(--primary)',
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
          },
        },
        secondary: {
          backgroundColor: 'var(--secondary)',
          color: 'var(--secondary-foreground)',
          '&:hover': {
            backgroundColor: 'var(--secondary-foreground)',
            color: 'var(--secondary)',
            border: '2px solid var(--secondary)',
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
          },
        },
        error: {
          backgroundColor: 'var(--destructive)',
          color: 'var(--destructive-foreground)',
          '&:hover': {
            backgroundColor: 'var(--destructive-foreground)',
            color: 'var(--destructive)',
            border: '2px solid var(--destructive)',
            '& .MuiSvgIcon-root': {
              color: 'inherit',
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
          borderRadius: 'var(--radius-ui)',
        },
      },
    },
  },
};
