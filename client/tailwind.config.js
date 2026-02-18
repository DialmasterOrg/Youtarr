const tokens = require('./src/theme/tokens.json');

const withOpacity = (hex) => ({ opacityValue }) => {
  if (opacityValue === undefined) return hex;
  const alpha = Math.round(Number(opacityValue) * 255)
    .toString(16)
    .padStart(2, '0');

  return `${hex}${alpha}`;
};

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx,mdx}', './.storybook/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: tokens.typography.fontFamily.split(','),
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
        sm: tokens.radius.sm,
        md: tokens.radius.md,
        lg: tokens.radius.lg,
        xl: tokens.radius.xl,
        full: tokens.radius.full,
      },
      spacing: tokens.spacing,
      colors: {
        app: {
          light: {
            primary: withOpacity(tokens.colors.light.primary.main),
            secondary: withOpacity(tokens.colors.light.secondary.main),
            bg: tokens.colors.light.background.default,
            surface: tokens.colors.light.background.surface,
            text: tokens.colors.light.text.primary,
            mutedText: tokens.colors.light.text.secondary,
            success: tokens.colors.light.semantic.success,
            warning: tokens.colors.light.semantic.warning,
            error: tokens.colors.light.semantic.error,
            info: tokens.colors.light.semantic.info,
          },
          dark: {
            primary: withOpacity(tokens.colors.dark.primary.main),
            secondary: withOpacity(tokens.colors.dark.secondary.main),
            bg: tokens.colors.dark.background.default,
            surface: tokens.colors.dark.background.surface,
            text: tokens.colors.dark.text.primary,
            mutedText: tokens.colors.dark.text.secondary,
            success: tokens.colors.dark.semantic.success,
            warning: tokens.colors.dark.semantic.warning,
            error: tokens.colors.dark.semantic.error,
            info: tokens.colors.dark.semantic.info,
          },
        },
      },
    },
  },
  plugins: [],
};
