import React from 'react';
import { cn } from '../../lib/cn';

/* ─── Badge ──────────────────────────────────────────────── */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  badgeContent?: React.ReactNode;
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  variant?: 'standard' | 'dot';
  max?: number;
  showZero?: boolean;
  invisible?: boolean;
  overlap?: 'rectangular' | 'circular';
  anchorOrigin?: { vertical: 'top' | 'bottom'; horizontal: 'left' | 'right' };
  sx?: Record<string, unknown>;
}

const badgeColorMap: Record<string, string> = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  error: 'bg-destructive text-destructive-foreground',
  info: 'bg-info text-info-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      badgeContent,
      color = 'default',
      variant = 'standard',
      max = 99,
      showZero = false,
      invisible,
      overlap: _overlap,
      anchorOrigin: _anchorOrigin,
      className,
      children,
      sx: _sx,
      ...props
    },
    ref
  ) => {
    const count = typeof badgeContent === 'number' ? badgeContent : null;
    const display = count !== null && count > max ? `${max}+` : badgeContent;
    const isHidden =
      invisible || (count !== null && count === 0 && !showZero);

    return (
      <span ref={ref} className={cn('relative inline-flex', className)} {...props}>
        {children}
        {!isHidden && (
          <span
            className={cn(
              'absolute -top-1 -right-1 z-10 flex items-center justify-center font-sans font-medium leading-none',
              badgeColorMap[color] ?? badgeColorMap.default,
              variant === 'dot'
                ? 'h-2 w-2 rounded-full p-0'
                : 'min-w-[18px] h-[18px] rounded-full px-1 text-[10px]'
            )}
          >
            {variant !== 'dot' && display}
          </span>
        )}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

/* ─── Skeleton ───────────────────────────────────────────── */
export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: number | string;
  height?: number | string;
  animation?: 'pulse' | 'wave' | false;
  sx?: Record<string, unknown>;
}

const Skeleton = React.forwardRef<HTMLSpanElement, SkeletonProps>(
  (
    {
      variant = 'text',
      width,
      height,
      animation = 'pulse',
      className,
      sx: _sx,
      style,
      ...props
    },
    ref
  ) => (
    <span
      ref={ref}
      className={cn(
        'block bg-muted',
        animation === 'pulse' && 'animate-pulse',
        variant === 'text' && 'rounded h-[1em] w-full',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-none',
        variant === 'rounded' && 'rounded-[var(--radius-ui)]',
        className
      )}
      style={{ width, height, ...style }}
      {...props}
    />
  )
);
Skeleton.displayName = 'Skeleton';

export { Badge, Skeleton };
