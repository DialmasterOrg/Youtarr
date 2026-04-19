import React from 'react';
import { createPortal } from 'react-dom';
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
  open?: boolean;
  onClose?: () => void;
  fullWidth?: boolean;
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
  fullWidth = false,
}) => {
  const triggerWrapperStyle: React.CSSProperties = fullWidth
    ? { position: 'relative', display: 'flex', width: '100%' }
    : { position: 'relative', display: 'inline-flex' };
  const [touchOpen, setTouchOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const [coarsePointer, setCoarsePointer] = React.useState(false);
  const [touchPosition, setTouchPosition] = React.useState<{ top: number; left: number } | null>(null);
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const [touchTooltipStyle, setTouchTooltipStyle] = React.useState<React.CSSProperties | null>(null);

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
      if (!triggerRef.current?.contains(event.target as Node) && !tooltipRef.current?.contains(event.target as Node)) {
        setTouchOpen(false);
        onClose?.();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [touchOpen, onClose]);

  React.useEffect(() => {
    if (!touchOpen || typeof window === 'undefined') {
      return;
    }

    const updatePosition = () => {
      if (!triggerRef.current) {
        return;
      }

      const rect = triggerRef.current.getBoundingClientRect();
      const top = placement.startsWith('bottom') ? rect.bottom + 8 : rect.top - 8;
      setTouchPosition({
        top,
        left: rect.left + rect.width / 2,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [touchOpen, placement]);

  React.useLayoutEffect(() => {
    if (!touchOpen || !touchPosition || typeof window === 'undefined') {
      return;
    }

    const insets = getOverlayInsets();
    const triggerRect = triggerRef.current?.getBoundingClientRect();

    if (!triggerRect) {
      return;
    }

    const estimatedMaxWidth = Math.min(320, Math.max(160, window.innerWidth - insets.left - insets.right));
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const tooltipWidth = tooltipRect?.width || estimatedMaxWidth;
    const tooltipHeight = tooltipRect?.height || 56;
    const left = clamp(
      touchPosition.left - tooltipWidth / 2,
      insets.left,
      window.innerWidth - insets.right - tooltipWidth,
    );
    const preferredBottom = triggerRect.bottom + 8;
    const preferredTop = triggerRect.top - tooltipHeight - 8;
    const fitsBelow = preferredBottom + tooltipHeight <= window.innerHeight - insets.bottom;
    const fitsAbove = preferredTop >= insets.top;
    const prefersBottom = placement.startsWith('bottom');

    let top = prefersBottom ? preferredBottom : preferredTop;

    if (prefersBottom && !fitsBelow && fitsAbove) {
      top = preferredTop;
    } else if (!prefersBottom && !fitsAbove && fitsBelow) {
      top = preferredBottom;
    }

    top = clamp(top, insets.top, window.innerHeight - insets.bottom - tooltipHeight);

    setTouchTooltipStyle({
      position: 'fixed',
      top,
      left,
      maxWidth: `min(20rem, calc(100vw - ${insets.left + insets.right}px))`,
      zIndex: 1700,
    });
  }, [touchOpen, touchPosition, placement]);

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
      <span style={triggerWrapperStyle}>
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
        onPointerUp: (e: React.PointerEvent) => {
          if (e.pointerType !== 'mouse') {
            if (triggerRef.current) {
              const rect = triggerRef.current.getBoundingClientRect();
              const top = placement.startsWith('bottom') ? rect.bottom + 8 : rect.top - 8;
              setTouchPosition({ top, left: rect.left + rect.width / 2 });
            }
            setTouchOpen(true);
          }
          (children.props as any).onPointerUp?.(e);
        },
        onClick: (e: React.MouseEvent) => {
          setTouchOpen(true);
          (children.props as any).onClick?.(e);
        },
      })
    : children;

  if (coarsePointer) {
    return (
      <>
        <span style={triggerWrapperStyle}>
          {childWithTouch}
        </span>
        {touchOpen && touchPosition && typeof document !== 'undefined'
          ? createPortal(
            <div
              ref={tooltipRef}
              role="tooltip"
              className={cn(tooltipClasses, 'animate-fade-in')}
              style={touchTooltipStyle ?? undefined}
            >
              {title}
            </div>,
            document.body
          )
          : null}
      </>
    );
  }

  return (
    <TooltipProvider>
      <TooltipPrimitive.Root
        open={undefined}
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
            collisionPadding={getOverlayInsets()}
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

function getOverlayInsets() {
  if (typeof window === 'undefined') {
    return { top: 12, bottom: 16, left: 12, right: 12 };
  }

  const styles = window.getComputedStyle(document.documentElement);
  const topInset = Number.parseFloat(styles.getPropertyValue('--app-shell-overlay-top-offset-px')) || 0;
  const bottomInset = Number.parseFloat(styles.getPropertyValue('--mobile-nav-total-offset-px')) || 0;

  return {
    top: topInset + 12,
    bottom: bottomInset + 16,
    left: 12,
    right: 12,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export { Tooltip, TooltipProvider };
