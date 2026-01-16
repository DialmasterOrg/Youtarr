export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        tertiary: 'var(--tertiary)',
        quaternary: 'var(--quaternary)',
        border: 'var(--border)',
        input: 'var(--input)',
        card: 'var(--card)',
        ring: 'var(--ring)',
      },
      boxShadow: {
        hard: 'var(--shadow-hard)',
        'hard-hover': 'var(--shadow-hard-hover)',
        'hard-active': 'var(--shadow-hard-active)',
      },
      transitionTimingFunction: {
        bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        wiggle: {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '35%': { transform: 'rotate(1deg) scale(1.02)' },
          '70%': { transform: 'rotate(-1deg) scale(1.02)' },
          '100%': { transform: 'rotate(0deg) scale(1)' },
        },
      },
      animation: {
        wiggle: 'wiggle 320ms var(--transition-bouncy)',
      },
      borderWidth: {
        2: '2px',
      },
      borderRadius: {
        sm: '8px',
        md: '16px',
        lg: '24px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
