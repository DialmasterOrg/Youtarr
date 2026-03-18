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

/** Duration in ms the tap-triggered tooltip stays visible before auto-hiding */
const TAP_TOOLTIP_DURATION = 2500;

const Tooltip: React.FC<TooltipProps> = ({
  title,
  children,
  placement = 'top',
  arrow = false,
  disableHoverListener = false,
  disableTouchListener = false,
  enterDelay = 200,
  enterTouchDelay: _enterTouchDelay,
  leaveTouchDelay: _leaveTouchDelay,
  className,
  open,
  onClose,
}) => {
  // Touch-open state for mobile tap support
  const [touchOpen, setTouchOpen] = React.useState(false);
  const touchTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  // No title → just render children
  if (!title) return children;

  // disableHoverListener without controlled open → just render children (no hover tooltip)
  if (disableHoverListener && open === undefined) return children;

  const side = placement.split('-')[0] as 'top' | 'bottom' | 'left' | 'right';
  const align = placement.includes('-start') ? 'start' : placement.includes('-end') ? 'end' : 'center';
  const isControlled = open !== undefined;

  const tooltipClasses = cn(
    'z-[1700] max-w-xs rounded-md bg-foreground px-2.5 py-1.5',
    'text-xs font-medium text-background leading-snug',
    'shadow-lg select-none break-words',
    className
  );

  // Controlled mode: simple inline overlay
  if (isControlled) {
    return (
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        {children}
        {open && (
          <div
            role="tooltip"
            className={cn(
              tooltipClasses,
              'absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5',
            )}
          >
            {title}
          </div>
        )}
      </span>
    );
  }

  // Touch handler: open on tap, auto-close after TAP_TOOLTIP_DURATION ms
  const handleTouchStart = disableTouchListener
    ? undefined
    : (e: React.TouchEvent) => {
        e.stopPropagation();
        clearTimeout(touchTimerRef.current);
        setTouchOpen(true);
        touchTimerRef.current = setTimeout(() => {
          setTouchOpen(false);
          onClose?.();
        }, TAP_TOOLTIP_DURATION);
      };

  const handleTouchEnd = disableTouchListener
    ? undefined
    : (e: React.TouchEvent) => {
        // Don't close immediately — let the timer handle it so the user sees the tooltip
        e.stopPropagation();
      };

  const childWithTouch = handleTouchStart
    ? React.cloneElement(children, {
        onTouchStart: (e: React.TouchEvent) => {
          handleTouchStart(e);
          (children.props as any).onTouchStart?.(e);
        },
        onTouchEnd: (e: React.TouchEvent) => {
          handleTouchEnd?.(e);
          (children.props as any).onTouchEnd?.(e);
        },
      })
    : children;

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root
        open={touchOpen || undefined}
        onOpenChange={(o) => {
          if (!o) {
            setTouchOpen(false);
            clearTimeout(touchTimerRef.current);
          }
        }}
        delayDuration={disableHoverListener ? 999999 : enterDelay}
      >
        <TooltipPrimitive.Trigger asChild>{childWithTouch}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={arrow ? 4 : 6}
            className={cn(tooltipClasses, 'animate-fade-in')}
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
