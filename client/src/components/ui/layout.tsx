import React from 'react';
import { cn } from '../../lib/cn';
import { ChevronLeft, ChevronRight } from '../../lib/icons';

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

/* ─── List components ──────────────────────────────────────── */
export interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  dense?: boolean;
  disablePadding?: boolean;
  subheader?: React.ReactNode;
  sx?: Record<string, unknown>;
}

const List = React.forwardRef<HTMLUListElement, ListProps>(
  ({ dense, disablePadding, subheader, className, children, sx: _sx, ...props }, ref) => (
    <ul
      ref={ref}
      className={cn(
        'list-none m-0',
        !disablePadding && 'py-2',
        dense && 'py-1',
        className
      )}
      {...props}
    >
      {subheader}
      {children}
    </ul>
  )
);
List.displayName = 'List';

export interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  dense?: boolean;
  disablePadding?: boolean;
  disableGutters?: boolean;
  divider?: boolean;
  selected?: boolean;
  alignItems?: 'flex-start' | 'center';
  secondaryAction?: React.ReactNode;
  sx?: Record<string, unknown>;
  component?: React.ElementType;
  disabled?: boolean;
}

const ListItem = React.forwardRef<HTMLLIElement, ListItemProps>(
  (
    {
      dense,
      disablePadding,
      disableGutters,
      divider,
      selected,
      alignItems = 'center',
      secondaryAction,
      className,
      children,
      sx: _sx,
      component: Component = 'li',
      disabled,
      ...props
    },
    ref
  ) =>
    React.createElement(
      Component as string,
      {
        ref,
        className: cn(
          'flex w-full',
          alignItems === 'center' ? 'items-center' : 'items-start',
          !disableGutters && !disablePadding && 'px-4',
          !disablePadding && (dense ? 'py-1' : 'py-2'),
          divider && 'border-b border-[var(--border)]',
          selected && 'bg-primary/10',
          disabled && 'opacity-50 pointer-events-none',
          className
        ),
        ...props,
      },
      children,
      secondaryAction && (
        <span className="ml-auto shrink-0 flex items-center">{secondaryAction}</span>
      )
    )
);
ListItem.displayName = 'ListItem';

export interface ListItemButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  dense?: boolean;
  disableGutters?: boolean;
  selected?: boolean;
  alignItems?: 'flex-start' | 'center';
  sx?: Record<string, unknown>;
  component?: React.ElementType;
  to?: string;
}

const ListItemButton = React.forwardRef<HTMLButtonElement, ListItemButtonProps>(
  (
    { dense, disableGutters, selected, alignItems = 'center', className, children, sx: _sx, component: Component = 'button', to, ...props },
    ref
  ) =>
    React.createElement(
      Component as string,
      {
        ref,
        type: Component === 'button' ? 'button' : undefined,
        ...(to !== undefined && { to }),
        className: cn(
          'flex w-full text-left cursor-pointer transition-colors',
          'hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          alignItems === 'center' ? 'items-center' : 'items-start',
          !disableGutters && 'px-4',
          dense ? 'py-1' : 'py-2',
          selected && 'bg-primary/10 text-primary',
          className
        ),
        ...props,
      },
      children
    )
);
ListItemButton.displayName = 'ListItemButton';

export interface ListItemTextProps extends React.HTMLAttributes<HTMLDivElement> {
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  disableTypography?: boolean;
  inset?: boolean;
  sx?: Record<string, unknown>;
  primaryTypographyProps?: Record<string, any>;
  secondaryTypographyProps?: Record<string, any>;
}

const ListItemText = React.forwardRef<HTMLDivElement, ListItemTextProps>(
  ({ primary, secondary, inset, className, children, sx: _sx, primaryTypographyProps, secondaryTypographyProps, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex-1 min-w-0', inset && 'pl-14', className)}
      {...props}
    >
      {primary && (
        <span
          className="block text-sm font-medium text-foreground truncate"
          style={primaryTypographyProps?.style}
        >{primary}</span>
      )}
      {secondary && (
        <span
          className="block text-xs font-normal text-muted-foreground truncate"
          style={secondaryTypographyProps?.style}
        >{secondary}</span>
      )}
      {children}
    </div>
  )
);
ListItemText.displayName = 'ListItemText';

export interface ListItemIconProps extends React.HTMLAttributes<HTMLDivElement> {
  sx?: Record<string, unknown>;
}

const ListItemIcon = React.forwardRef<HTMLDivElement, ListItemIconProps>(
  ({ className, children, sx: _sx, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('shrink-0 flex items-center justify-center min-w-[40px] text-muted-foreground [&>svg]:h-5 [&>svg]:w-5', className)}
      {...props}
    >
      {children}
    </div>
  )
);
ListItemIcon.displayName = 'ListItemIcon';

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

/* ─── Pagination ──────────────────────────────────────────── */
export interface PaginationProps {
  count: number;
  page: number;
  onChange?: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'standard';
  shape?: 'circular' | 'rounded';
  className?: string;
  sx?: Record<string, unknown>;
}
const Pagination: React.FC<PaginationProps> = ({ count, page, onChange, size = 'medium', className }) => {
  const pages = Array.from({ length: count }, (_, i) => i + 1);
  const btnSize = size === 'small' ? 'h-7 w-7 text-xs' : size === 'large' ? 'h-10 w-10 text-base' : 'h-8 w-8 text-sm';
  return (
    <nav className={cn('flex items-center gap-1', className)} aria-label="pagination" role="navigation">
      <button
        onClick={(e) => onChange?.(e, Math.max(1, page - 1))}
        disabled={page === 1}
        className={cn(btnSize, 'rounded-[var(--radius-ui)] border border-border disabled:opacity-40 hover:bg-muted transition-colors inline-flex items-center justify-center')}
        aria-label="go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={(e) => onChange?.(e, p)}
          className={cn(
            btnSize,
            'rounded-[var(--radius-ui)] border transition-colors inline-flex items-center justify-center',
            p === page
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-muted'
          )}
          aria-label={`go to page ${p}`}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      <button
        onClick={(e) => onChange?.(e, Math.min(count, page + 1))}
        disabled={page === count}
        className={cn(btnSize, 'rounded-[var(--radius-ui)] border border-border disabled:opacity-40 hover:bg-muted transition-colors inline-flex items-center justify-center')}
        aria-label="go to next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
};

export { Container, Divider, Stack, List, ListItem, ListItemButton, ListItemText, ListItemIcon, Badge, Skeleton, Link, CssBaseline, Toolbar, Pagination };

