import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-sans font-bold leading-none',
    'transition-all duration-[var(--transition-base)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'rounded-[var(--radius-ui)]',
    '[border-radius:var(--radius-ui)]',
  ],
  {
    variants: {
      variant: {
        contained: [
          'bg-primary text-primary-foreground',
          'border-0',
          'hover:opacity-90 active:opacity-80',
          'shadow-sm',
        ],
        outlined: [
          'bg-transparent text-primary',
          'border-2 border-primary',
          'hover:bg-primary hover:text-primary-foreground active:opacity-80',
        ],
        text: [
          'bg-transparent text-primary border-0',
          'hover:bg-muted active:opacity-80',
        ],
        secondary: [
          'bg-secondary text-secondary-foreground border-0',
          'hover:opacity-90 active:opacity-80',
        ],
        ghost: [
          'bg-transparent text-foreground border-0',
          'hover:bg-muted active:opacity-80',
        ],
        destructive: [
          'bg-destructive text-destructive-foreground border-0',
          'hover:opacity-90 active:opacity-80',
        ],
        'outlined-destructive': [
          'bg-transparent text-destructive border-2 border-destructive',
          'hover:bg-destructive hover:text-destructive-foreground',
        ],
        link: ['bg-transparent text-primary underline-offset-4 hover:underline border-0 p-0 h-auto'],
      },
      size: {
        sm: 'text-xs px-3 py-1.5 h-8',
        md: 'text-sm px-4 py-2 h-10',
        lg: 'text-base px-6 py-2.5 h-12',
        icon: 'p-2 h-10 w-10',
        'icon-sm': 'p-1.5 h-8 w-8',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'text',
      size: 'md',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'>,
    Omit<VariantProps<typeof buttonVariants>, 'size'> {
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'small' | 'medium' | 'large' | null;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'inherit';
  asChild?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  loading?: boolean;
  component?: React.ElementType;
  to?: string;
  sx?: React.CSSProperties;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, color = 'primary', asChild = false, startIcon, endIcon, loading, children, disabled, component: _component, to: _to, sx, style, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const normalizedSize = size === 'small' ? 'sm' : size === 'medium' ? 'md' : size === 'large' ? 'lg' : size;
    
    // When asChild={true}, just pass children through to Slot
    // Don't render extra elements as Slot expects a single element child
    if (asChild) {
      return (
        <Comp
          ref={ref}
          disabled={disabled || loading}
          data-btn
          className={cn(
            buttonVariants({ variant, size: normalizedSize, fullWidth, className }),
            variant === 'contained' && 'btn-contained',
            variant === 'outlined' && 'btn-outlined',
            variant === 'text' && 'btn-text',
            variant === 'contained' && color === 'primary' && 'btn-contained-primary',
            variant === 'contained' && color === 'secondary' && 'btn-contained-secondary',
            variant === 'contained' && color === 'error' && 'btn-contained-error',
            variant === 'contained' && color === 'warning' && 'btn-contained-warning',
            variant === 'outlined' && color === 'primary' && 'btn-outlined-primary',
            variant === 'outlined' && color === 'secondary' && 'btn-outlined-secondary',
            variant === 'outlined' && color === 'error' && 'btn-outlined-error',
            variant === 'outlined' && color === 'warning' && 'btn-outlined-warning',
            normalizedSize === 'sm' && 'btn-sm',
            normalizedSize === 'md' && 'btn-md',
            normalizedSize === 'lg' && 'btn-lg'
          )}
          style={{ ...sx, ...style }}
          {...props}
        >
          {children}
        </Comp>
      );
    }
    
    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        data-btn
        className={cn(
          buttonVariants({ variant, size: normalizedSize, fullWidth, className }),
          variant === 'contained' && 'btn-contained',
          variant === 'outlined' && 'btn-outlined',
          variant === 'text' && 'btn-text',
          variant === 'contained' && color === 'primary' && 'btn-contained-primary',
          variant === 'contained' && color === 'secondary' && 'btn-contained-secondary',
          variant === 'contained' && color === 'error' && 'btn-contained-error',
          variant === 'contained' && color === 'warning' && 'btn-contained-warning',
          variant === 'outlined' && color === 'primary' && 'btn-outlined-primary',
          variant === 'outlined' && color === 'secondary' && 'btn-outlined-secondary',
          variant === 'outlined' && color === 'error' && 'btn-outlined-error',
          variant === 'outlined' && color === 'warning' && 'btn-outlined-warning',
          normalizedSize === 'sm' && 'btn-sm',
          normalizedSize === 'md' && 'btn-md',
          normalizedSize === 'lg' && 'btn-lg'
        )}
        style={{ ...sx, ...style }}
        {...props}
      >
        {loading ? (
          <svg data-testid="loading-spinner" className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : startIcon ? (
          <span className="shrink-0 [&>svg]:h-[1.25em] [&>svg]:w-[1.25em]">{startIcon}</span>
        ) : null}
        {children}
        {endIcon && !loading && (
          <span className="shrink-0 [&>svg]:h-[1.25em] [&>svg]:w-[1.25em]">{endIcon}</span>
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

/**
 * IconButton - circular/square button for icon-only actions.
 * Matches MUI's IconButton visually.
 */
const iconButtonVariants = cva(
  [
    'inline-flex items-center justify-center rounded-full',
    'text-foreground/80 hover:bg-muted',
    'transition-all duration-[var(--transition-base)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    '[&>svg]:shrink-0',
  ],
  {
    variants: {
      size: {
        sm: 'p-1 [&>svg]:h-4 [&>svg]:w-4',
        md: 'p-2 [&>svg]:h-5 [&>svg]:w-5',
        lg: 'p-2.5 [&>svg]:h-6 [&>svg]:w-6',
      },
      color: {
        default: 'text-foreground/80 hover:bg-muted',
        primary: 'text-primary hover:bg-primary/10',
        secondary: 'text-secondary hover:bg-secondary/10',
        success: 'text-success hover:bg-success/10',
        warning: 'text-warning hover:bg-warning/10',
        info: 'text-info hover:bg-info/10',
        inherit: 'text-inherit hover:bg-muted',
        error: 'text-destructive hover:bg-destructive/10',
      },
    },
    defaultVariants: {
      size: 'md',
      color: 'default',
    },
  }
);

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'size'>,
    Omit<VariantProps<typeof iconButtonVariants>, 'size'> {
  size?: 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large' | null;
  'aria-label'?: string;
  asChild?: boolean;
  edge?: 'start' | 'end' | false;
  component?: React.ElementType;
  to?: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size, color, asChild = false, edge, children, component: _component, to: _to, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const normalizedSize = size === 'small' ? 'sm' : size === 'medium' ? 'md' : size === 'large' ? 'lg' : size;
    return (
      <Comp
        ref={ref}
        type="button"
        data-icon-btn
        className={cn(
          iconButtonVariants({ size: normalizedSize, color }),
          edge === 'start' && '-ml-2',
          edge === 'end' && '-mr-2',
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
IconButton.displayName = 'IconButton';
/* ─── Fab ───────────────────────────────────────────────
   Floating Action Button shim
──────────────────────────────────────────────────────── */
export interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'primary' | 'secondary' | 'error' | 'default';
  size?: 'small' | 'medium' | 'large';
  variant?: 'circular' | 'extended';
  children?: React.ReactNode;
}

const colorMap: Record<string, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
  error: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  default: 'bg-muted text-foreground hover:bg-muted/80',
};

const sizeMap: Record<string, string> = {
  small: 'w-10 h-10',
  medium: 'w-14 h-14',
  large: 'w-16 h-16',
};

const Fab = React.forwardRef<HTMLButtonElement, FabProps>(
  ({ color = 'primary', size = 'medium', variant = 'circular', className, children, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'rounded-full flex items-center justify-center shadow-lg transition-all duration-[var(--transition-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          colorMap[color] ?? colorMap.primary,
          sizeMap[size] ?? sizeMap.medium,
          variant === 'extended' ? 'rounded-2xl px-4 gap-2' : '',
          className
        )}
        style={style}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Fab.displayName = 'Fab';

export { Button, IconButton, Fab, buttonVariants };
