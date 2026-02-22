const tokens = require('./src/theme/tokens.json');

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
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        tertiary: {
          DEFAULT: 'var(--tertiary)',
          foreground: 'var(--tertiary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        input: 'var(--input)',
        ring: 'var(--ring)',
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
