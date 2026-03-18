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
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const [coarsePointer, setCoarsePointer] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarsePointer(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  React.useEffect(() => {
    if (!touchOpen || typeof document === 'undefined') {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) {
        setTouchOpen(false);
        onClose?.();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [touchOpen, onClose]);

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

  const childWithTouch = !disableTouchListener && coarsePointer
    ? React.cloneElement(children, {
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node;
          const childRef = (children as any).ref;
          if (typeof childRef === 'function') {
            childRef(node);
          } else if (childRef && typeof childRef === 'object') {
            childRef.current = node;
          }
        },
        onTouchStart: (e: React.TouchEvent) => {
          setTouchOpen(true);
          (children.props as any).onTouchStart?.(e);
        },
        onClick: (e: React.MouseEvent) => {
          setTouchOpen(true);
          (children.props as any).onClick?.(e);
        },
      })
    : children;

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root
        open={coarsePointer ? touchOpen : undefined}
        onOpenChange={(o) => {
          if (!o) {
            setTouchOpen(false);
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
