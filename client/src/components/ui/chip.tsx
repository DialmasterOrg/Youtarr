import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

const chipVariants = cva(
  [
    'inline-flex items-center justify-center gap-1',
    'font-sans font-medium leading-none select-none',
    'transition-all duration-[var(--transition-base)]',
    'rounded-full border',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  ],
  {
    variants: {
      variant: {
        filled: 'border-transparent',
        outlined: 'bg-transparent',
      },
      color: {
        default: '',
        primary: '',
        secondary: '',
        error: '',
        warning: '',
        success: '',
        info: '',
      },
      size: {
        small: 'text-xs px-2 h-6 [&>svg]:h-3 [&>svg]:w-3',
        medium: 'text-sm px-3 h-8 [&>svg]:h-4 [&>svg]:w-4',
      },
      clickable: {
        true: 'cursor-pointer',
        false: '',
      },
    },
    compoundVariants: [
      // filled
      { variant: 'filled', color: 'default',   class: 'bg-muted text-foreground hover:bg-muted/80' },
      { variant: 'filled', color: 'primary',   class: 'bg-primary text-primary-foreground hover:opacity-90' },
      { variant: 'filled', color: 'secondary', class: 'bg-secondary text-secondary-foreground hover:opacity-90' },
      { variant: 'filled', color: 'error',     class: 'bg-destructive text-destructive-foreground hover:opacity-90' },
      { variant: 'filled', color: 'warning',   class: 'bg-warning text-warning-foreground hover:opacity-90' },
      { variant: 'filled', color: 'success',   class: 'bg-success text-success-foreground hover:opacity-90' },
      { variant: 'filled', color: 'info',      class: 'bg-info text-info-foreground hover:opacity-90' },
      // outlined
      { variant: 'outlined', color: 'default',   class: 'border-[var(--border-strong)] text-foreground hover:bg-muted/50' },
      { variant: 'outlined', color: 'primary',   class: 'border-primary text-primary hover:bg-primary/10' },
      { variant: 'outlined', color: 'secondary', class: 'border-secondary text-secondary hover:bg-secondary/10' },
      { variant: 'outlined', color: 'error',     class: 'border-destructive text-destructive hover:bg-destructive/10' },
      { variant: 'outlined', color: 'warning',   class: 'border-warning text-warning hover:bg-warning/10' },
      { variant: 'outlined', color: 'success',   class: 'border-success text-success hover:bg-success/10' },
      { variant: 'outlined', color: 'info',      class: 'border-info text-info hover:bg-info/10' },
    ],
    defaultVariants: {
      variant: 'filled',
      color: 'default',
      size: 'medium',
      clickable: false,
    },
  }
);

export interface ChipProps extends VariantProps<typeof chipVariants> {
  label?: React.ReactNode;
  onDelete?: () => void;
  onClick?: React.MouseEventHandler<HTMLElement>;
  icon?: React.ReactNode;
  avatar?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  deleteIcon?: React.ReactNode;
  sx?: Record<string, unknown>;
  style?: React.CSSProperties;
}

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  ({ label, onDelete, onClick, icon, avatar, disabled, className, variant, color, size, deleteIcon, sx: _sx, style, ...rest }, ref) => {
    const isClickable = !!onClick;
    const Tag = isClickable ? 'button' : 'div';

    return React.createElement(
      Tag,
      {
        ref,
        style,
        disabled: isClickable ? disabled : undefined,
        onClick,
        className: cn(
          chipVariants({ variant, color, size, clickable: isClickable }),
          disabled && 'opacity-50 pointer-events-none',
          className
        ),
        ...(isClickable ? { type: 'button' } : {}),
      },
      avatar && <span className="shrink-0 -ml-0.5">{avatar}</span>,
      icon && <span className="shrink-0 [&>svg]:h-[1em] [&>svg]:w-[1em]">{icon}</span>,
      <span key="label" className="px-0.5 truncate">{label}</span>,
      onDelete && (
        <button
          key="delete"
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={disabled}
          aria-label="Remove"
          className="shrink-0 ml-0.5 -mr-1 rounded-full p-0.5 hover:bg-black/10 focus-visible:outline-none"
        >
          {deleteIcon ?? <X className="h-3 w-3" />}
        </button>
      )
    );
  }
);
Chip.displayName = 'Chip';

export { Chip };
