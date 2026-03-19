import React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../../lib/cn';

/* ─── LinearProgress ──────────────────────────────────── */
export interface LinearProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  variant?: 'determinate' | 'indeterminate' | 'buffer' | 'query';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'inherit';
  /** Custom bar height in pixels (overrides the default h-1 class) */
  height?: number;
  /** Custom CSS color for the progress bar indicator */
  barColor?: string;
  /** Additional className for the progress bar indicator */
  barClassName?: string;
  sx?: Record<string, unknown>;
}

const LinearProgress = React.forwardRef<HTMLDivElement, LinearProgressProps>(
  ({ value, variant = 'indeterminate', color = 'primary', height, barColor, barClassName, className, style, sx: _sx, ...props }, ref) => {
    const colorClass: Record<string, string> = {
      primary: 'bg-primary',
      secondary: 'bg-secondary',
      error: 'bg-destructive',
      warning: 'bg-warning',
      info: 'bg-info',
      success: 'bg-success',
      inherit: 'bg-current',
    };

    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={variant === 'determinate' ? value : undefined}
        role="progressbar"
        aria-valuenow={variant === 'determinate' ? Math.round(value ?? 0) : undefined}
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-muted',
          !height && 'h-1',
          className
        )}
        style={height ? { height, borderRadius: 'var(--radius-ui)', ...style } : style}
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-testid="progress-indicator"
          className={cn(
            'h-full w-full flex-1 rounded-full',
            !barColor && (colorClass[color] ?? 'bg-primary'),
            variant === 'indeterminate' && 'animate-spin opacity-50',
            barClassName,
          )}
          style={{
            ...(variant === 'determinate' ? { transform: `translateX(-${100 - (value ?? 0)}%)` } : { transform: 'translateX(-40%)' }),
            ...(barColor ? { backgroundColor: barColor, transition: 'background-color 0.3s ease, width 0.3s ease' } : { transition: 'width 0.3s ease' }),
          }}
        />
      </ProgressPrimitive.Root>
    );
  }
);
LinearProgress.displayName = 'LinearProgress';

/* ─── CircularProgress ────────────────────────────────── */
export interface CircularProgressProps extends React.HTMLAttributes<HTMLSpanElement> {
  value?: number;
  variant?: 'determinate' | 'indeterminate';
  size?: number | string;
  thickness?: number;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'inherit';
  disableShrink?: boolean;
}

const CircularProgress = React.forwardRef<HTMLSpanElement, CircularProgressProps>(
  ({ value = 0, variant = 'indeterminate', size = 40, thickness = 3.6, color = 'primary', className, style, ...props }, ref) => {
    const colorMap: Record<string, string> = {
      primary: 'text-primary',
      secondary: 'text-secondary',
      error: 'text-destructive',
      warning: 'text-warning',
      info: 'text-info',
      success: 'text-success',
      inherit: 'text-current',
    };
    const r = 21;
    const circumference = 2 * Math.PI * r;
    const strokeDash = variant === 'determinate'
      ? `${(value / 100) * circumference} ${circumference}`
      : undefined;

    return (
      <span
        ref={ref}
        role="progressbar"
        aria-valuenow={variant === 'determinate' ? value : undefined}
        style={{ width: size, height: size, ...style }}
        className={cn(
          'inline-flex items-center justify-center',
          variant === 'indeterminate' && 'animate-spin',
          colorMap[color] ?? 'text-primary',
          className
        )}
        {...props}
      >
        <svg viewBox="22 22 44 44" fill="none" className="w-full h-full">
          <circle
            data-testid="progress-circle"
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={strokeDash ?? `${circumference * 0.75} ${circumference * 0.25}`}
          />
        </svg>
      </span>
    );
  }
);
CircularProgress.displayName = 'CircularProgress';

export { LinearProgress, CircularProgress };
