import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/cn';

const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  title?: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  arrow?: boolean;
  disableHoverListener?: boolean;
  disableFocusListener?: boolean;
  disableTouchListener?: boolean;
  enterDelay?: number;
  enterTouchDelay?: number;
  leaveTouchDelay?: number;
  className?: string;
  sx?: Record<string, unknown>;
  open?: boolean;
  onClose?: () => void;
}

const Tooltip: React.FC<TooltipProps> = ({
  title,
  children,
  placement = 'top',
  arrow = false,
  disableHoverListener = false,
  enterDelay = 200,
  enterTouchDelay: _enterTouchDelay,
  leaveTouchDelay: _leaveTouchDelay,
  className,
  open,
  onClose,
}) => {
  // No title → just render children
  if (!title) return children;

  // disableHoverListener without controlled open → just render children (no hover tooltip)
  if (disableHoverListener && open === undefined) return children;

  const side = placement.split('-')[0] as 'top' | 'bottom' | 'left' | 'right';
  const align = placement.includes('-start') ? 'start' : placement.includes('-end') ? 'end' : 'center';
  const isControlled = open !== undefined;

  // Controlled mode: use a simple custom approach to avoid Radix duplicating text
  // in both the visible element and the SR-only aria live region.
  if (isControlled) {
    return (
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        {children}
        {open && (
          <div
            role="tooltip"
            className={cn(
              'z-[1700] max-w-xs rounded-md bg-foreground px-2.5 py-1.5',
              'text-xs font-medium text-background leading-snug',
              'shadow-lg select-none break-words',
              'absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5',
              className
            )}
          >
            {title}
          </div>
        )}
      </span>
    );
  }

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root
        delayDuration={disableHoverListener ? 999999 : enterDelay}
      >
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={arrow ? 4 : 6}
            className={cn(
              'z-[1700] max-w-xs rounded-md bg-foreground px-2.5 py-1.5',
              'text-xs font-medium text-background leading-snug',
              'shadow-lg animate-fade-in',
              'select-none break-words',
              className
            )}
          >
            {title}
            {arrow && <TooltipPrimitive.Arrow className="fill-foreground" />}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
};

export { Tooltip, TooltipProvider };
