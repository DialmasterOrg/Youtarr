const tokens = require('./src/theme/tokens.json');

const semanticColor = (tokenName) => `hsl(var(--${tokenName}-raw) / <alpha-value>)`;

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx,mdx}', './.storybook/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Outfit', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: tokens.typography.size.xs,
        sm: tokens.typography.size.sm,
        base: tokens.typography.size.base,
        lg: tokens.typography.size.lg,
        xl: tokens.typography.size.xl,
        '2xl': tokens.typography.size['2xl'],
      },
      borderRadius: {
        ui: 'var(--radius-ui)',
        input: 'var(--radius-input)',
        thumb: 'var(--radius-thumb)',
        sm: tokens.radius.sm,
        md: tokens.radius.md,
        lg: tokens.radius.lg,
        xl: tokens.radius.xl,
        full: tokens.radius.full,
      },
      spacing: tokens.spacing,
      colors: {
        // Semantic CSS variable-driven colors (theme-aware)
        background: semanticColor('background'),
        foreground: semanticColor('foreground'),
        card: {
          DEFAULT: semanticColor('card'),
          foreground: semanticColor('card-foreground'),
        },
        popover: {
          DEFAULT: semanticColor('popover'),
          foreground: semanticColor('popover-foreground'),
        },
        primary: {
          DEFAULT: semanticColor('primary'),
          foreground: semanticColor('primary-foreground'),
        },
        secondary: {
          DEFAULT: semanticColor('secondary'),
          foreground: semanticColor('secondary-foreground'),
        },
        tertiary: {
          DEFAULT: semanticColor('tertiary'),
          foreground: semanticColor('tertiary-foreground'),
        },
        muted: {
          DEFAULT: semanticColor('muted'),
          foreground: semanticColor('muted-foreground'),
        },
        accent: {
          DEFAULT: semanticColor('accent'),
          foreground: semanticColor('accent-foreground'),
        },
        destructive: {
          DEFAULT: semanticColor('destructive'),
          foreground: semanticColor('destructive-foreground'),
        },
        success: {
          DEFAULT: semanticColor('success'),
          foreground: semanticColor('success-foreground'),
        },
        warning: {
          DEFAULT: semanticColor('warning'),
          foreground: semanticColor('warning-foreground'),
        },
        info: {
          DEFAULT: semanticColor('info'),
          foreground: semanticColor('info-foreground'),
        },
        border: semanticColor('border'),
        'border-strong': semanticColor('border-strong'),
        input: semanticColor('input'),
        ring: semanticColor('ring'),
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        hard: 'var(--shadow-hard)',
        'hard-hover': 'var(--shadow-hard-hover)',
        neumo: 'var(--shadow-neumo)',
      },
      transitionTimingFunction: {
        bouncy: 'var(--transition-bouncy)',
      },
      keyframes: {
        wiggle: {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '35%': { transform: 'rotate(1deg) scale(1.02)' },
          '70%': { transform: 'rotate(-1deg) scale(1.02)' },
          '100%': { transform: 'rotate(0deg) scale(1)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        wiggle: 'wiggle 320ms var(--transition-bouncy)',
        'pop-in': 'pop-in 200ms ease',
        'fade-in': 'fade-in 150ms ease',
        'slide-up': 'slide-up 150ms ease',
        'slide-down': 'slide-down 150ms ease',
        spin: 'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
};
