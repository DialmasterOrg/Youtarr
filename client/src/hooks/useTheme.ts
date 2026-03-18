import { useThemeEngine } from '../contexts/ThemeEngineContext';

/**
 * Theme hook that exposes palette-style accessors backed by CSS variables.
 * For new code, prefer Tailwind classes or direct CSS variable reads.
 */

function cssVar(name: string): string {
  return `hsl(var(${name}))`;
}

function alpha(color: string, opacity: number): string {
  // If it's already a hsl(var(...)) style, we use the /opacity Tailwind trick
  // via inline style. We return a CSS string that browsers can parse.
  // For CSS var-based colors we can use the HSL channel trick.
  if (color.startsWith('hsl(var(') && color.endsWith('))')) {
    const varName = color.slice('hsl('.length, -1); // var(--xxx)
    return `hsl(${varName} / ${opacity})`;
  }
  // Fallback: inject opacity into a known hex/rgb color
  return color; // best-effort; callers should switch to Tailwind opacity modifiers
}

export function useTheme() {
  const { colorMode } = useThemeEngine();

  const palette = {
    mode: colorMode,
    primary: {
      main: cssVar('--primary'),
      light: cssVar('--primary'),
      dark: cssVar('--primary'),
      contrastText: cssVar('--primary-foreground'),
    },
    secondary: {
      main: cssVar('--secondary'),
      light: cssVar('--secondary'),
      dark: cssVar('--secondary'),
      contrastText: cssVar('--secondary-foreground'),
    },
    error: {
      main: cssVar('--destructive'),
      light: cssVar('--destructive'),
      dark: cssVar('--destructive'),
      contrastText: cssVar('--destructive-foreground'),
    },
    warning: {
      main: cssVar('--warning'),
      light: cssVar('--warning'),
      dark: cssVar('--warning'),
      contrastText: cssVar('--warning-foreground'),
    },
    info: {
      main: cssVar('--info'),
      light: cssVar('--info'),
      dark: cssVar('--info'),
      contrastText: cssVar('--info-foreground'),
    },
    success: {
      main: cssVar('--success'),
      light: cssVar('--success'),
      dark: cssVar('--success'),
      contrastText: cssVar('--success-foreground'),
    },
    background: {
      default: cssVar('--background'),
      paper: cssVar('--card'),
    },
    text: {
      primary: cssVar('--foreground'),
      secondary: cssVar('--muted-foreground'),
      disabled: cssVar('--muted-foreground'),
    },
    divider: 'var(--border)',
    action: {
      active: 'var(--foreground)',
      hover: 'var(--muted)',
      selected: 'var(--accent)',
      disabled: 'var(--muted-foreground)',
      disabledBackground: 'var(--muted)',
    },
  };

  return {
    palette,
    spacing: (factor: number) => `${factor * 8}px`,
    breakpoints: {
      up: (bp: string) => `@media (min-width:${({ xs: '0px', sm: '600px', md: '900px', lg: '1200px', xl: '1536px' } as Record<string, string>)[bp] ?? bp})`,
      down: (bp: string) => `@media (max-width:${({ xs: '599.95px', sm: '899.95px', md: '1199.95px', lg: '1535.95px', xl: '9999px' } as Record<string, string>)[bp] ?? bp})`,
      values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
    },
    zIndex: {
      mobileStepper: 1000,
      fab: 1050,
      speedDial: 1050,
      appBar: 1100,
      drawer: 1200,
      modal: 1300,
      snackbar: 1400,
      tooltip: 1500,
    },
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: 'var(--font-sans, sans-serif)',
      fontSize: 14,
      htmlFontSize: 14,
    },
    shadows: Array(25).fill('none') as string[],
    // Alpha helper for palette-style consumers
    alpha,
  };
}

// Re-export alpha as a standalone helper
export { alpha };

// Type alias for components that use Theme as a type parameter
export type Theme = ReturnType<typeof useTheme>;
