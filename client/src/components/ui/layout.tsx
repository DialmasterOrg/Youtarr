import React from 'react';
import { cn } from '../../lib/cn';

/* ─── Container ─────────────────────────────────────────────
  Centers content with an optional max width.
──────────────────────────────────────────────────────────── */
const maxWidthMap: Record<string, string> = {
  xs: 'max-w-sm',
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-[1536px]',
  false: 'max-w-none',
};

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disableGutters?: boolean;
  fixed?: boolean;
  component?: React.ElementType;
  sx?: Record<string, unknown>;
}

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      maxWidth = 'lg',
      disableGutters = false,
      className,
      children,
      sx: _sx,
      component: Component = 'div',
      ...props
    },
    ref
  ) =>
    React.createElement(
      Component as string,
      {
        ref,
        className: cn(
          'w-full mx-auto',
          maxWidthMap[String(maxWidth)] ?? 'max-w-none',
          !disableGutters && 'px-4 sm:px-6 lg:px-8',
          className
        ),
        ...props,
      },
      children
    )
);
Container.displayName = 'Container';

/* ─── Divider ───────────────────────────────────────────────
  Horizontal or vertical rule.
──────────────────────────────────────────────────────────── */
export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'fullWidth' | 'inset' | 'middle';
  flexItem?: boolean;
  light?: boolean;
  component?: React.ElementType;
  sx?: Record<string, unknown>;
  textAlign?: 'center' | 'left' | 'right';
}

const Divider = React.forwardRef<HTMLHRElement, DividerProps>(
  (
    {
      orientation = 'horizontal',
      variant = 'fullWidth',
      flexItem: _flexItem,
      light,
      component: Component = 'hr',
      className,
      children,
      sx: _sx,
      textAlign,
      ...props
    },
    ref
  ) => {
    if (children) {
      return (
        <div
          className={cn(
            'flex items-center gap-3 text-xs text-muted-foreground',
            textAlign === 'left' && 'flex-row-reverse',
            textAlign === 'right' && 'flex-row',
            className
          )}
        >
          <span className="flex-1 border-t border-[var(--border)]" />
          <span>{children}</span>
          <span className="flex-1 border-t border-[var(--border)]" />
        </div>
      );
    }

    return React.createElement(Component as string, {
      ref,
      className: cn(
        orientation === 'horizontal'
          ? 'w-full border-t border-[var(--border)]'
          : 'h-full border-l border-[var(--border)] self-stretch',
        variant === 'inset' && 'ml-16',
        variant === 'middle' && 'mx-4',
        light && 'opacity-50',
        className
      ),
      ...props,
    });
  }
);
Divider.displayName = 'Divider';

/* ─── Stack ─────────────────────────────────────────────────
  Shorthand flex layout wrapper.
──────────────────────────────────────────────────────────── */
const spacingClassMap: Record<number, string> = {
  0: 'gap-0', 0.5: 'gap-0.5', 1: 'gap-1', 1.5: 'gap-1.5',
  2: 'gap-2', 2.5: 'gap-2.5', 3: 'gap-3', 4: 'gap-4',
  5: 'gap-5', 6: 'gap-6', 8: 'gap-8', 10: 'gap-10',
};

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  spacing?: number;
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
  divider?: React.ReactNode;
  useFlexGap?: boolean;
  component?: React.ElementType;
  sx?: Record<string, unknown>;
}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = 'column',
      spacing = 0,
      alignItems,
      justifyContent,
      flexWrap,
      divider,
      className,
      children,
      sx: _sx,
      component: Component = 'div',
      ...props
    },
    ref
  ) => {
    const dirClass =
      direction === 'row' ? 'flex-row' :
      direction === 'row-reverse' ? 'flex-row-reverse' :
      direction === 'column-reverse' ? 'flex-col-reverse' : 'flex-col';

    const alignClass =
      alignItems === 'center' ? 'items-center' :
      alignItems === 'flex-end' ? 'items-end' :
      alignItems === 'flex-start' ? 'items-start' :
      alignItems === 'baseline' ? 'items-baseline' : '';

    const justifyClass =
      justifyContent === 'center' ? 'justify-center' :
      justifyContent === 'flex-end' ? 'justify-end' :
      justifyContent === 'space-between' ? 'justify-between' :
      justifyContent === 'space-around' ? 'justify-around' : '';

    const wrapClass = flexWrap === 'wrap' ? 'flex-wrap' : flexWrap === 'wrap-reverse' ? 'flex-wrap-reverse' : '';
    const gapClass = spacingClassMap[spacing] ?? '';

    const items = React.Children.toArray(children).filter(Boolean);

    return React.createElement(
      Component as string,
      {
        ref,
        className: cn('flex', dirClass, alignClass, justifyClass, wrapClass, gapClass, className),
        ...props,
      },
      divider
        ? items.flatMap((child, i) =>
            i < items.length - 1
              ? [child, React.cloneElement(divider as React.ReactElement, { key: `divider-${i}` })]
              : [child]
          )
        : children
    );
  }
);
Stack.displayName = 'Stack';

/* ─── Link ───────────────────────────────────────────────── */
export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  underline?: 'always' | 'hover' | 'none';
  color?: string;
  variant?: string;
  component?: React.ElementType;
  sx?: Record<string, unknown>;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ underline = 'hover', className, children, sx: _sx, component: Component = 'a', color: _color, variant: _variant, ...props }, ref) =>
    React.createElement(
      Component as string,
      {
        ref,
        className: cn(
          'text-primary cursor-pointer',
          underline === 'always' && 'underline',
          underline === 'hover' && 'hover:underline',
          underline === 'none' && 'no-underline',
          className
        ),
        ...props,
      },
      children
    )
);
Link.displayName = 'Link';

/* ─── CssBaseline ─────────────────────────────────────────── */
// No-op — base styles are handled by Tailwind's preflight + ThemeEngineContext
const CssBaseline: React.FC = () => null;

/* ─── Toolbar ─────────────────────────────────────────────── */
// Toolbar: a horizontal flex container with padding
export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  disableGutters?: boolean;
  dense?: boolean;
  variant?: 'regular' | 'dense';
  sx?: Record<string, unknown>;
}
const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ disableGutters = false, dense = false, variant: _v, className, children, sx: _sx, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center',
        !disableGutters && 'px-4',
        dense ? 'min-h-[48px]' : 'min-h-[56px]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Toolbar.displayName = 'Toolbar';

export { Container, Divider, Stack, Link, CssBaseline, Toolbar };
