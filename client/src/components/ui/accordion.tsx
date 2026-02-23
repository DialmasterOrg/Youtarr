import React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const AccordionRoot = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      'border-b border-border last:border-0',
      className
    )}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-between py-4 px-0',
        'font-medium text-sm font-sans text-foreground',
        'transition-all hover:text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        '[&[data-state=open]>svg]:rotate-180',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 opacity-60 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden text-sm',
      'data-[state=closed]:animate-[accordion-up_0.2s_ease-out]',
      'data-[state=open]:animate-[accordion-down_0.2s_ease-out]',
      className
    )}
    {...props}
  >
    <div className="pb-4">{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = 'AccordionContent';

/* ─── MUI-compat Accordion/AccordionSummary/AccordionDetails ─ */
export interface AccordionProps {
  expanded?: boolean;
  onChange?: (event: React.SyntheticEvent, expanded: boolean) => void;
  defaultExpanded?: boolean;
  disabled?: boolean;
  disableGutters?: boolean;
  elevation?: number;
  square?: boolean;
  children?: React.ReactNode;
  className?: string;
  TransitionProps?: Record<string, unknown>;
}

let _accordionId = 0;
const Accordion: React.FC<AccordionProps> = ({
  expanded,
  onChange,
  defaultExpanded = false,
  disabled,
  children,
  className,
  disableGutters: _dg,
}) => {
  const id = React.useRef(`acc-${++_accordionId}`).current;
  const isControlled = expanded !== undefined;
  const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded);
  const isOpen = isControlled ? expanded : internalExpanded;

  return (
    <AccordionRoot
      type="single"
      value={isOpen ? id : ''}
      onValueChange={(v) => {
        const nowOpen = v === id;
        if (!isControlled) setInternalExpanded(nowOpen);
        onChange?.({} as React.SyntheticEvent, nowOpen);
      }}
      disabled={disabled}
      className={cn('bg-card rounded-[var(--radius-ui)] border border-[var(--border-strong)]', className)}
    >
      <AccordionItem value={id} className="border-0">
        {children}
      </AccordionItem>
    </AccordionRoot>
  );
};

export interface AccordionSummaryProps extends React.HTMLAttributes<HTMLDivElement> {
  expandIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const AccordionSummary: React.FC<AccordionSummaryProps> = ({ expandIcon, children, className }) => (
  <AccordionTrigger className={cn('px-4', className)}>
    <span className="flex items-center gap-2 flex-1">{children}</span>
    {expandIcon && <span className="shrink-0">{expandIcon}</span>}
  </AccordionTrigger>
);

const AccordionDetails = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <AccordionContent>
      <div ref={ref} className={cn('px-4 pb-4', className)} {...props}>
        {children}
      </div>
    </AccordionContent>
  )
);
AccordionDetails.displayName = 'AccordionDetails';

export {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
};
