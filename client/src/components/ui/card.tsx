import React from 'react';
import { cn } from '../../lib/cn';

/* ─── Card ─────────────────────────────────────────────── */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: number;
  variant?: 'elevation' | 'outlined';
  raised?: boolean;
  disabled?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, disabled, children, ...props }, ref) => (
    <div
      ref={ref}
      data-card
      className={cn(
        'bg-card text-foreground rounded-[var(--radius-ui)]',
        'border-[length:var(--border-weight)] border-[var(--border-strong)]',
        'transition-all duration-[var(--transition-base)]',
        'hover:[transform:var(--card-hover-transform)] hover:shadow-[var(--card-hover-shadow)]',
        variant === 'outlined' && 'shadow-none',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

/* ─── CardActionArea ──────────────────────────────────── */
export interface CardActionAreaProps extends React.HTMLAttributes<HTMLElement> {
  component?: React.ElementType;
  to?: string;
  href?: string;
  disabled?: boolean;
}
const CardActionArea = React.forwardRef<HTMLElement, CardActionAreaProps>(
  ({ className, children, onClick, component: Component = 'div', to, href, disabled = false, ...props }, ref) => {
    const isDiv = Component === 'div';
    return React.createElement(
      Component,
      {
        ref,
        'data-card-action': '',
        ...(isDiv && { role: 'button', tabIndex: 0 }),
        onClick: disabled ? undefined : onClick,
        ...(isDiv && {
          onKeyDown: (e: React.KeyboardEvent) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) onClick?.(e as any);
          },
        }),
        className: cn(
          'w-full cursor-pointer rounded-[var(--radius-ui)] outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'pointer-events-none opacity-50',
          className
        ),
        ...(disabled && { 'aria-disabled': true }),
        ...(to !== undefined && { to }),
        ...(href !== undefined && { href }),
        ...props,
      },
      children
    );
  }
);
CardActionArea.displayName = 'CardActionArea';

/* ─── CardContent ─────────────────────────────────────── */
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 last:pb-4', className)} {...props}>
      {children}
    </div>
  )
);
CardContent.displayName = 'CardContent';

/* ─── CardHeader ──────────────────────────────────────── */
export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subheader?: React.ReactNode;
  avatar?: React.ReactNode;
  action?: React.ReactNode;
  titleTypographyProps?: Record<string, unknown>;
  subheaderTypographyProps?: Record<string, unknown>;
  align?: 'left' | 'center' | 'right';
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, subheader, avatar, action, children, align = 'left', ...props }, ref) => (
    <div ref={ref} className={cn('flex items-start gap-3 px-4 py-3', align === 'center' && 'text-center justify-center', align === 'right' && 'text-right justify-end', className)} {...props}>
      {avatar && <div className="shrink-0">{avatar}</div>}
      <div className="flex-1 min-w-0">
        {title && <div className="font-display font-bold text-base text-foreground leading-snug">{title}</div>}
        {subheader && <div className="text-sm text-muted-foreground mt-0.5">{subheader}</div>}
        {children}
      </div>
      {action && <div className="shrink-0 -mt-1 -mr-2">{action}</div>}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';

export { Card, CardActionArea, CardContent, CardHeader };
