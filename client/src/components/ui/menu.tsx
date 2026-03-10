import React from 'react';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../../lib/cn';
import { MenuItem } from './select';

/* ─── Menu (MUI-compat) ───────────────────────────────── */
export interface MenuProps {
  open: boolean;
  anchorEl?: HTMLElement | null;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  PaperProps?: { sx?: Record<string, unknown>; className?: string; elevation?: number; style?: React.CSSProperties };
  anchorOrigin?: { vertical: 'top' | 'bottom' | 'center'; horizontal: 'left' | 'right' | 'center' };
  transformOrigin?: { vertical: 'top' | 'bottom' | 'center'; horizontal: 'left' | 'right' | 'center' };
  keepMounted?: boolean;
  disablePortal?: boolean;
  id?: string;
}

/**
 * Menu – uses a Popover internally anchored to the trigger button.
 * For backwards-compat with MUI's anchorEl pattern we use a fixed-pos
 * div portal positioned at anchorEl's bounding box.
 */
const Menu: React.FC<MenuProps> = ({
  open,
  anchorEl,
  onClose,
  children,
  className,
  PaperProps,
  keepMounted = false,
  anchorOrigin = { vertical: 'bottom', horizontal: 'left' },
  transformOrigin = { vertical: 'top', horizontal: 'left' },
}) => {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const getAnchorOffset = React.useCallback((rect: DOMRect) => {
    const vertical =
      anchorOrigin.vertical === 'top'
        ? rect.top
        : anchorOrigin.vertical === 'center'
          ? rect.top + rect.height / 2
          : rect.bottom;
    const horizontal =
      anchorOrigin.horizontal === 'left'
        ? rect.left
        : anchorOrigin.horizontal === 'center'
          ? rect.left + rect.width / 2
          : rect.right;
    return { top: vertical + 4, left: horizontal };
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!open || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPos(getAnchorOffset(rect));
  }, [open, anchorEl, getAnchorOffset]);

  React.useEffect(() => {
    updatePosition();
    if (!open) return;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  const transformX =
    transformOrigin.horizontal === 'left'
      ? '0%'
      : transformOrigin.horizontal === 'center'
        ? '-50%'
        : '-100%';
  const transformY =
    transformOrigin.vertical === 'top'
      ? '0%'
      : transformOrigin.vertical === 'center'
        ? '-50%'
        : '-100%';

  if (!open && !keepMounted) return null;

  // Compute a viewport-safe maxHeight so the menu never extends off-screen.
  // For menus that open downward (transformY '0%') we measure from pos.top to the
  // bottom of the viewport; for upward menus ('-100%') we measure from pos.top to
  // the top of the viewport.
  const viewportMax = pos
    ? transformY === '-100%'
      ? pos.top - 16
      : window.innerHeight - pos.top - 16
    : undefined;
  const paperPropsMax =
    typeof PaperProps?.style?.maxHeight === 'number' ? PaperProps.style.maxHeight : undefined;
  const resolvedMaxHeight =
    viewportMax !== undefined
      ? paperPropsMax !== undefined
        ? Math.min(paperPropsMax, viewportMax)
        : viewportMax
      : paperPropsMax;
  // Strip maxHeight from PaperProps.style so we can apply the clamped value ourselves.
  const { maxHeight: _pMax, ...paperStyleRest } = PaperProps?.style ?? {};

  return (
    <>
      {/* Backdrop */}
      {open && <div data-testid="menu-backdrop" className="fixed inset-0 z-40" onClick={onClose} />}
      {/* Menu panel */}
      <div
        role="menu"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose?.();
        }}
        style={pos
          ? {
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: `translate(${transformX}, ${transformY})`,
              zIndex: 1300,
              ...(resolvedMaxHeight !== undefined ? { maxHeight: resolvedMaxHeight } : {}),
              overflowY: 'auto',
              ...paperStyleRest,
            }
          : {
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 1300,
              overflowY: 'auto',
              ...paperStyleRest,
            }}
        hidden={!open}
        aria-hidden={!open}
        className={cn(
          'min-w-[12rem] overflow-x-hidden',
          'rounded-[var(--radius-ui)]',
          'border-[length:var(--border-weight)] border-[var(--border-strong)]',
          'bg-popover text-popover-foreground',
          'shadow-hard',
          'p-1',
          'animate-slide-down',
          PaperProps?.className,
          className
        )}
      >
        {children}
      </div>
    </>
  );
};

/* ─── Popover (MUI-compat) ────────────────────────────── */
export interface PopoverProps {
  open: boolean;
  anchorEl?: HTMLElement | null;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  anchorOrigin?: { vertical: string; horizontal: string };
  transformOrigin?: { vertical: string; horizontal: string };
  PaperProps?: { className?: string };
  disablePortal?: boolean;
  id?: string;
}

const Popover: React.FC<PopoverProps> = ({ open, anchorEl, onClose, children, className, PaperProps }) => {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!open || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open, anchorEl]);

  React.useEffect(() => {
    updatePosition();
    if (!open) return;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }}
        style={pos ? {
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 1300,
          maxHeight: window.innerHeight - pos.top - 16,
          overflowY: 'auto',
        } : undefined}
        className={cn(
          'overflow-x-hidden',
          'rounded-[var(--radius-ui)]',
          'border-[length:var(--border-weight)] border-[var(--border-strong)]',
          'bg-popover text-popover-foreground',
          'shadow-hard',
          'animate-slide-down',
          PaperProps?.className,
          className
        )}
      >
        {children}
      </div>
    </>
  );
};

/* ─── DropdownMenu wrappers (Radix-native) ────────────── */
const DropdownMenu = MenuPrimitive.Root;
const DropdownMenuTrigger = MenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[12rem] overflow-hidden p-1',
        'rounded-[var(--radius-ui)]',
        'border-[length:var(--border-weight)] border-[var(--border-strong)]',
        'bg-popover text-popover-foreground shadow-hard',
        'data-[state=open]:animate-slide-down',
        className
      )}
      {...props}
    />
  </MenuPrimitive.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <MenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none',
      'transition-colors focus:bg-muted focus:text-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export { Menu, Popover, MenuItem, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator };
