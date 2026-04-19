import React from 'react';
import { cn } from '../../lib/cn';

/* ─── List components ──────────────────────────────────────── */
export interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  dense?: boolean;
  disablePadding?: boolean;
  subheader?: React.ReactNode;
}

const List = React.forwardRef<HTMLUListElement, ListProps>(
  ({ dense, disablePadding, subheader, className, children, ...props }, ref) => (
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
  component?: React.ElementType;
  to?: string;
}

const ListItemButton = React.forwardRef<HTMLButtonElement, ListItemButtonProps>(
  (
    { dense, disableGutters, selected, alignItems = 'center', className, children, component: Component = 'button', to, ...props },
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
  primaryTypographyProps?: Record<string, any>;
  secondaryTypographyProps?: Record<string, any>;
}

const ListItemText = React.forwardRef<HTMLDivElement, ListItemTextProps>(
  ({ primary, secondary, inset, className, children, primaryTypographyProps, secondaryTypographyProps, ...props }, ref) => (
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

export type ListItemIconProps = React.HTMLAttributes<HTMLDivElement>;

const ListItemIcon = React.forwardRef<HTMLDivElement, ListItemIconProps>(
  ({ className, children, ...props }, ref) => (
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

export { List, ListItem, ListItemButton, ListItemText, ListItemIcon };
