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
  onChange?: (event: React.SyntheticEvent, value: string | number) => void;
  children?: React.ReactNode;
  className?: string;
  textColor?: string;
  indicatorColor?: string;
  variant?: string;
  scrollButtons?: string | boolean;
}

const Tabs: React.FC<TabsProps> = ({ value, onChange, children, className }) => (
  <TabsRoot
    value={String(value)}
    onValueChange={(v) => onChange?.({} as React.SyntheticEvent, v)}
    className={cn('w-full', className)}
  >
    {children}
  </TabsRoot>
);

export interface TabProps {
  value?: string | number;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end' | 'top' | 'bottom';
  disabled?: boolean;
  className?: string;
  wrapped?: boolean;
  style?: React.CSSProperties;
}

const Tab: React.FC<TabProps> = ({ value, label, icon, iconPosition = 'start', disabled, className, style }) => (
  <TabsTrigger
    value={String(value)}
    disabled={disabled}
    style={style}
    className={cn(iconPosition === 'top' && 'flex-col', className)}
  >
    {(iconPosition === 'start' || iconPosition === 'top') && icon}
    {label}
    {(iconPosition === 'end' || iconPosition === 'bottom') && icon}
  </TabsTrigger>
);

export { Tabs, Tab, TabsRoot, TabsList, TabsTrigger, TabsContent };
