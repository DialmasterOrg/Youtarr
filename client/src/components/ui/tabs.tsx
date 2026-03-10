import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/cn';

const TabsRoot = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-end border-b border-border w-full',
      className
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { label?: React.ReactNode }
>(({ className, children, label, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium font-sans',
      'text-muted-foreground border-b-2 border-transparent',
      'transition-colors duration-[var(--transition-base)]',
      'hover:text-foreground',
      'disabled:pointer-events-none disabled:opacity-50',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'data-[state=active]:text-primary data-[state=active]:border-b-primary',
      '-mb-px',
      className
    )}
    {...props}
  >
    {label ?? children}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

/* ─── MUI-compat Tabs/Tab ─────────────────────────────── */
export interface TabsProps {
  value?: string | number;
  onChange?: (event: React.SyntheticEvent, value: any) => void;
  children?: React.ReactNode;
  className?: string;
  textColor?: string;
  indicatorColor?: string;
  variant?: string;
  scrollButtons?: string | boolean;
  centered?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'data-testid'?: string;
}

const Tabs: React.FC<TabsProps> = ({
  value,
  onChange,
  children,
  className,
  centered = false,
  variant = 'standard',
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'data-testid': dataTestId,
}) => {
  const interactionEventRef = React.useRef<React.SyntheticEvent | null>(null);
  const isScrollable = variant === 'scrollable';
  const isFullWidth = variant === 'fullWidth';

  // MUI auto-assigns integer indices to Tab children that have no explicit value.
  const indexedChildren = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child)) return child;

    const childProps: Partial<TabProps> = {
      fullWidth: isFullWidth,
      scrollable: isScrollable,
      onInteraction: (event: React.SyntheticEvent) => {
        interactionEventRef.current = event;
      },
    };

    if ((child.props as TabProps).value === undefined) {
      childProps.value = index;
    }

    return React.cloneElement(child as React.ReactElement<TabProps>, childProps);
  });

  return (
    <TabsRoot
      value={value !== undefined ? String(value) : undefined}
      onValueChange={(v) => {
        // Coerce back to number if the value looks like an integer string
        const num = parseInt(v, 10);
        const output: string | number = !isNaN(num) && String(num) === v ? num : v;
        onChange?.(interactionEventRef.current ?? ({ type: 'change' } as React.SyntheticEvent), output);
        interactionEventRef.current = null;
      }}
      className={cn('w-full', className)}
    >
      {/* MUI Tabs renders Tab children directly; Radix requires them inside a
          TabsList for the RovingFocusGroup context. We wrap automatically. */}
      <TabsList
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        data-testid={dataTestId}
        className={cn(
          centered && !isScrollable && !isFullWidth && 'justify-center',
          isScrollable && 'overflow-x-auto overflow-y-hidden whitespace-nowrap flex-nowrap gap-1',
          isFullWidth && 'grid grid-flow-col auto-cols-fr',
        )}
      >
        {indexedChildren}
      </TabsList>
    </TabsRoot>
  );
};

export interface TabProps {
  value?: string | number;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end' | 'top' | 'bottom';
  disabled?: boolean;
  className?: string;
  wrapped?: boolean;
  style?: React.CSSProperties;
  fullWidth?: boolean;
  scrollable?: boolean;
  onInteraction?: (event: React.SyntheticEvent) => void;
}

const Tab: React.FC<TabProps> = ({
  value,
  label,
  icon,
  iconPosition = 'start',
  disabled,
  className,
  style,
  fullWidth = false,
  scrollable = false,
  onInteraction,
}) => (
  <TabsTrigger
    value={String(value)}
    disabled={disabled}
    style={style}
    onClickCapture={onInteraction}
    onKeyDownCapture={onInteraction}
    onPointerDownCapture={onInteraction}
    className={cn(
      iconPosition === 'top' && 'flex-col',
      fullWidth && 'w-full justify-center',
      scrollable && 'shrink-0',
      className
    )}
  >
    {(iconPosition === 'start' || iconPosition === 'top') && icon}
    {label}
    {(iconPosition === 'end' || iconPosition === 'bottom') && icon}
  </TabsTrigger>
);

export { Tabs, Tab, TabsRoot, TabsList, TabsTrigger, TabsContent };
