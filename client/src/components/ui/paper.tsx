import React from 'react';
import { cn } from '../../lib/cn';

export interface PaperProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: number;
  variant?: 'elevation' | 'outlined';
  square?: boolean;
  component?: React.ElementType;
}

const elevationShadow: Record<number, string> = {
  0: 'shadow-none',
  1: 'shadow-sm',
  2: 'shadow',
  3: 'shadow-md',
  4: 'shadow-md',
  6: 'shadow-lg',
  8: 'shadow-lg',
  16: 'shadow-xl',
  24: 'shadow-2xl',
};

const Paper = React.forwardRef<HTMLDivElement, PaperProps>(
  ({ elevation = 1, variant = 'elevation', square = false, component: Component = 'div', className, children, ...props }, ref) => {
    const shadow = elevationShadow[elevation] ?? (elevation <= 0 ? 'shadow-none' : elevation <= 2 ? 'shadow' : elevation <= 8 ? 'shadow-lg' : 'shadow-2xl');
    return (
      <Component
        ref={ref}
        className={cn(
          'bg-card text-foreground',
          !square && 'rounded-[var(--radius-ui)]',
          variant === 'elevation' && shadow,
          variant === 'outlined' && 'border border-[var(--border-strong)] shadow-none',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Paper.displayName = 'Paper';

export { Paper };
