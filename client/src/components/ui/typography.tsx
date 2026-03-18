import React from 'react';
import { cn } from '../../lib/cn';

type TypographyVariant =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'subtitle1' | 'subtitle2'
  | 'body1' | 'body2'
  | 'caption' | 'overline'
  | 'inherit';

const variantMap: Record<TypographyVariant, { tag: keyof React.JSX.IntrinsicElements; className: string }> = {
  h1: { tag: 'h1', className: 'font-display font-extrabold text-4xl leading-tight' },
  h2: { tag: 'h2', className: 'font-display font-extrabold text-3xl leading-tight' },
  h3: { tag: 'h3', className: 'font-display font-extrabold text-2xl leading-tight' },
  h4: { tag: 'h4', className: 'font-display font-bold text-xl leading-snug' },
  h5: { tag: 'h5', className: 'font-display font-bold text-lg leading-snug' },
  h6: { tag: 'h6', className: 'font-display font-bold text-base leading-snug' },
  subtitle1: { tag: 'p', className: 'font-sans font-semibold text-base leading-normal' },
  subtitle2: { tag: 'p', className: 'font-sans font-semibold text-sm leading-normal' },
  body1: { tag: 'p', className: 'font-sans text-base leading-relaxed' },
  body2: { tag: 'p', className: 'font-sans text-sm leading-relaxed' },
  caption: { tag: 'span', className: 'font-sans text-xs leading-normal' },
  overline: { tag: 'span', className: 'font-sans text-xs uppercase tracking-wider leading-normal' },
  inherit: { tag: 'span', className: 'inherit' },
};

const colorMap: Record<string, string> = {
  primary: 'text-foreground',
  secondary: 'text-muted-foreground',
  textPrimary: 'text-foreground',
  textSecondary: 'text-muted-foreground',
  error: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-info',
  inherit: 'text-inherit',
  initial: '',
};

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TypographyVariant;
  component?: keyof React.JSX.IntrinsicElements | React.ElementType;
  color?: string;
  gutterBottom?: boolean;
  paragraph?: boolean;
  noWrap?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify' | 'inherit';
  fontWeight?: string | number;
  to?: string;
  display?: string;
  sx?: React.CSSProperties & { mb?: number | string };
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ variant = 'body1', component, color, gutterBottom, paragraph, noWrap, align, fontWeight, display: displayProp, to: _to, className, children, style, sx, ...props }, ref) => {
    const mapping = variantMap[variant];
    const Tag = (component || (paragraph ? 'p' : mapping.tag)) as keyof React.JSX.IntrinsicElements;
    const mergedStyle = {
      ...(sx?.mb !== undefined ? { marginBottom: typeof sx.mb === 'number' ? `${sx.mb * 8}px` : sx.mb } : {}),
      ...sx,
      fontWeight,
      display: displayProp,
      ...style,
    };

    return React.createElement(
      Tag,
      {
        ref,
        className: cn(
          mapping.className,
          `typo-${variant}`,
          color && colorMap[color],
          // If color string looks like 'text.primary' from MUI
          color === 'text.primary' && 'text-foreground',
          color === 'text.secondary' && 'text-muted-foreground',
          color === 'text.disabled' && 'text-muted-foreground/50',
          gutterBottom && 'mb-2',
          paragraph && 'mb-4',
          noWrap && 'truncate',
          align && align !== 'inherit' && `text-${align}`,
          className
        ),
        style: mergedStyle,
        ...props,
      },
      children
    );
  }
);
Typography.displayName = 'Typography';

export { Typography };
