import React from 'react';
import { cn } from '../../lib/cn';

/* ─── Card ─────────────────────────────────────────────── */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: number;
  variant?: 'elevation' | 'outlined';
  raised?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-card text-foreground rounded-[var(--radius-ui)]',
        'border-[length:var(--border-weight)] border-[var(--border-strong)]',
        'transition-all duration-[var(--transition-base)]',
        'hover:[transform:var(--card-hover-transform)] hover:shadow-[var(--card-hover-shadow)]',
        variant === 'outlined' && 'shadow-none',
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
const CardActionArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, onClick, ...props }, ref) => (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(e as any); }}
      className={cn(
        'w-full cursor-pointer rounded-[var(--radius-ui)] outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
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
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  subheader?: React.ReactNode;
  avatar?: React.ReactNode;
  action?: React.ReactNode;
  titleTypographyProps?: Record<string, unknown>;
  subheaderTypographyProps?: Record<string, unknown>;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, subheader, avatar, action, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-start gap-3 px-4 py-3', className)} {...props}>
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
