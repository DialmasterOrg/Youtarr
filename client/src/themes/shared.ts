import { ThemeOptions } from '@mui/material/styles';

export const fabBase = {
  root: {
    transition: 'all 200ms ease',
    border: '1px solid transparent',
    '& .MuiSvgIcon-root': {
      color: 'inherit',
    },
  },
};

export const commonThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: [
      'var(--font-body)',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'sans-serif',
    ].join(','),
    h1: { fontFamily: 'var(--font-display)', fontWeight: 800 },
    h2: { fontFamily: 'var(--font-display)', fontWeight: 800 },
    h3: { fontFamily: 'var(--font-display)', fontWeight: 800 },
    h4: { fontFamily: 'var(--font-display)', fontWeight: 700 },
    h5: { fontFamily: 'var(--font-display)', fontWeight: 700 },
    h6: { fontFamily: 'var(--font-display)', fontWeight: 700 },
    button: { fontWeight: 700 },
  },
  shape: {
    borderRadius: 0,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid var(--border-strong)',
          backgroundColor: 'var(--card)',
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          border: 'var(--border-weight) solid var(--border-strong)',
          boxShadow: 'var(--shadow-soft)',
          transition: 'transform 300ms var(--transition-bouncy), box-shadow 300ms var(--transition-bouncy)',
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
          border: 'var(--border-weight) solid var(--border-strong)',
          boxShadow: 'none',
          textTransform: 'none',
          fontWeight: 700,
          transition:
            'transform 300ms var(--transition-bouncy), box-shadow 300ms var(--transition-bouncy), background-color 300ms var(--transition-bouncy)',
          '&:hover': {
            transform: 'translate(-2px, -2px)',
            boxShadow: 'var(--shadow-hard-hover)',
          },
          '&:active': {
            transform: 'translate(2px, 2px)',
            boxShadow: 'var(--shadow-hard-active)',
          },
        },
        containedPrimary: {
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          '&.Mui-disabled': {
            backgroundColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        containedSecondary: {
          backgroundColor: 'var(--secondary)',
          color: 'var(--foreground)',
          '&.Mui-disabled': {
            backgroundColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        outlined: {
          border: 'var(--border-weight) solid var(--border-strong)',
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
          },
          '&.Mui-disabled': {
            borderColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
        outlinedWarning: {
          color: 'var(--accent)',
          borderColor: 'var(--accent)',
          '&:hover': {
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-foreground)',
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
          },
          '&.Mui-disabled': {
            borderColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
            opacity: 0.5,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-input)',
          backgroundColor: 'var(--input)',
          boxShadow: 'var(--shadow-input-rest)',
          transition: 'box-shadow 250ms var(--transition-bouncy), border-color 250ms var(--transition-bouncy)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--input-border)',
            borderWidth: 'var(--border-weight)',
          },
          /* 
             Removed aggressive legend overrides here to allow index.css 
             to handle the notch width based on .MuiInputLabel-shrink state 
          */
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--input-border-hover)',
          },
          '&.Mui-focused': {
            boxShadow: 'var(--shadow-input-focus)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--ring)',
            borderWidth: 'var(--border-weight)',
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          transition: 'all 200ms ease',
          border: '1px solid transparent',
          '& .MuiSvgIcon-root': {
            color: 'inherit',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-ui)',
          backgroundColor: 'var(--muted)',
          opacity: 0.6,
        },
        bar: {
          borderRadius: 'var(--radius-ui)',
          backgroundColor: 'var(--primary)',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        },
      },
    },
  },
};
