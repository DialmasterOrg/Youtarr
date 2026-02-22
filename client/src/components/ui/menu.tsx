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
  PaperProps?: { sx?: Record<string, unknown>; className?: string; elevation?: number };
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
const Menu: React.FC<MenuProps> = ({ open, anchorEl, onClose, children, className, PaperProps }) => {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useEffect(() => {
    if (open && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
    }
  }, [open, anchorEl]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Menu panel */}
      <div
        role="menu"
        style={pos ? { position: 'absolute', top: pos.top + 4, left: pos.left, zIndex: 1300 } : undefined}
        className={cn(
          'min-w-[12rem] overflow-hidden',
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

  React.useEffect(() => {
    if (open && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
    }
  }, [open, anchorEl]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        style={pos ? { position: 'absolute', top: pos.top + 4, left: pos.left, zIndex: 1300 } : undefined}
        className={cn(
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
