import React from 'react';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../../lib/cn';
import { MenuItem } from './select';

function getOverlayInsets() {
  if (typeof window === 'undefined') {
    return { top: 12, bottom: 16 };
  }

  const styles = window.getComputedStyle(document.documentElement);
  const topInset = Number.parseFloat(styles.getPropertyValue('--app-shell-overlay-top-offset-px')) || 0;
  const bottomInset = Number.parseFloat(styles.getPropertyValue('--mobile-nav-total-offset-px')) || 0;

  return { top: topInset + 12, bottom: bottomInset + 16 };
}

type OverlayOrigin = {
  vertical: 'top' | 'bottom' | 'center';
  horizontal: 'left' | 'right' | 'center';
};

type MenuSize = {
  width: number;
  height: number;
};

type MenuPlacement = {
  top: number;
  left: number;
  maxHeight: number;
};

const MENU_GAP = 4;
const VIEWPORT_GUTTER = 12;

function flipVerticalOrigin(origin: OverlayOrigin['vertical']) {
  if (origin === 'top') return 'bottom';
  if (origin === 'bottom') return 'top';
  return 'center';
}

function flipHorizontalOrigin(origin: OverlayOrigin['horizontal']) {
  if (origin === 'left') return 'right';
  if (origin === 'right') return 'left';
  return 'center';
}

function getAnchorPoint(rect: DOMRect, origin: OverlayOrigin) {
  const top =
    origin.vertical === 'top'
      ? rect.top
      : origin.vertical === 'center'
        ? rect.top + rect.height / 2
        : rect.bottom;
  const left =
    origin.horizontal === 'left'
      ? rect.left
      : origin.horizontal === 'center'
        ? rect.left + rect.width / 2
        : rect.right;

  return { top, left };
}

function getMenuSize(menuElement: HTMLElement | null): MenuSize {
  if (!menuElement || typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }

  const rect = menuElement.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(menuElement);
  const width = rect.width || Number.parseFloat(computedStyle.width) || menuElement.scrollWidth || 0;
  const height = rect.height || Number.parseFloat(computedStyle.height) || menuElement.scrollHeight || 0;

  return { width, height };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildPlacement(
  anchorRect: DOMRect,
  menuSize: MenuSize,
  anchorOrigin: OverlayOrigin,
  transformOrigin: OverlayOrigin,
  overlayInsets: { top: number; bottom: number }
): MenuPlacement {
  const anchorPoint = getAnchorPoint(anchorRect, anchorOrigin);
  const top =
    transformOrigin.vertical === 'top'
      ? anchorPoint.top + MENU_GAP
      : transformOrigin.vertical === 'center'
        ? anchorPoint.top - menuSize.height / 2
        : anchorPoint.top - menuSize.height - MENU_GAP;
  const left =
    transformOrigin.horizontal === 'left'
      ? anchorPoint.left
      : transformOrigin.horizontal === 'center'
        ? anchorPoint.left - menuSize.width / 2
        : anchorPoint.left - menuSize.width;

  const viewportTop = overlayInsets.top;
  const viewportBottom = window.innerHeight - overlayInsets.bottom;
  const viewportLeft = VIEWPORT_GUTTER;
  const viewportRight = window.innerWidth - VIEWPORT_GUTTER;

  const availableHeight = transformOrigin.vertical === 'bottom' ? top - viewportTop : viewportBottom - top;
  const maxHeight = Math.max(availableHeight, 0);

  return {
    top,
    left,
    maxHeight,
  };
}

/* ─── Menu ────────────────────────────────────────────── */
export interface MenuProps {
  open: boolean;
  anchorEl?: HTMLElement | null;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  PaperProps?: { className?: string; elevation?: number; style?: React.CSSProperties };
  anchorOrigin?: { vertical: 'top' | 'bottom' | 'center'; horizontal: 'left' | 'right' | 'center' };
  transformOrigin?: { vertical: 'top' | 'bottom' | 'center'; horizontal: 'left' | 'right' | 'center' };
  keepMounted?: boolean;
  disablePortal?: boolean;
  id?: string;
}

/**
 * Menu anchored to a trigger element using fixed positioning.
 */
const Menu: React.FC<MenuProps> = (props) => {
  const {
    open,
    anchorEl,
    onClose,
    children,
    className,
    PaperProps,
    anchorOrigin = { vertical: 'bottom', horizontal: 'left' },
    transformOrigin = { vertical: 'top', horizontal: 'left' },
    keepMounted = false,
  } = props;

  const [pos, setPos] = React.useState<MenuPlacement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const overlayInsets = getOverlayInsets();

  const updatePosition = React.useCallback(() => {
    if (!open || !anchorEl || !menuRef.current || typeof window === 'undefined') return;

    const anchorRect = anchorEl.getBoundingClientRect();
    const menuSize = getMenuSize(menuRef.current);

    const originVariants: Array<{ anchorOrigin: OverlayOrigin; transformOrigin: OverlayOrigin; flipCount: number }> = [
      { anchorOrigin, transformOrigin, flipCount: 0 },
      {
        anchorOrigin: {
          vertical: flipVerticalOrigin(anchorOrigin.vertical),
          horizontal: anchorOrigin.horizontal,
        },
        transformOrigin: {
          vertical: flipVerticalOrigin(transformOrigin.vertical),
          horizontal: transformOrigin.horizontal,
        },
        flipCount: 1,
      },
      {
        anchorOrigin: {
          vertical: anchorOrigin.vertical,
          horizontal: flipHorizontalOrigin(anchorOrigin.horizontal),
        },
        transformOrigin: {
          vertical: transformOrigin.vertical,
          horizontal: flipHorizontalOrigin(transformOrigin.horizontal),
        },
        flipCount: 1,
      },
      {
        anchorOrigin: {
          vertical: flipVerticalOrigin(anchorOrigin.vertical),
          horizontal: flipHorizontalOrigin(anchorOrigin.horizontal),
        },
        transformOrigin: {
          vertical: flipVerticalOrigin(transformOrigin.vertical),
          horizontal: flipHorizontalOrigin(transformOrigin.horizontal),
        },
        flipCount: 2,
      },
    ];

    const viewportTop = overlayInsets.top;
    const viewportBottom = window.innerHeight - overlayInsets.bottom;
    const viewportLeft = VIEWPORT_GUTTER;
    const viewportRight = window.innerWidth - VIEWPORT_GUTTER;

    const scoredPlacements = originVariants.map(({ anchorOrigin: candidateAnchorOrigin, transformOrigin: candidateTransformOrigin, flipCount }) => {
      const placement = buildPlacement(anchorRect, menuSize, candidateAnchorOrigin, candidateTransformOrigin, overlayInsets);

      const overflowTop = Math.max(viewportTop - placement.top, 0);
      const overflowBottom = Math.max(placement.top + menuSize.height - viewportBottom, 0);
      const overflowLeft = Math.max(viewportLeft - placement.left, 0);
      const overflowRight = Math.max(placement.left + menuSize.width - viewportRight, 0);

      return {
        ...placement,
        flipCount,
        score: overflowTop + overflowBottom + overflowLeft + overflowRight,
      };
    });

    const bestPlacement = scoredPlacements.reduce((best, current) => {
      if (current.score < best.score) return current;
      if (current.score > best.score) return best;
      return current.flipCount < best.flipCount ? current : best;
    });

    const clampedTop = clamp(bestPlacement.top, viewportTop, Math.max(viewportBottom - menuSize.height, viewportTop));
    const clampedLeft = clamp(bestPlacement.left, viewportLeft, Math.max(viewportRight - menuSize.width, viewportLeft));
    const nextPlacement = {
      ...bestPlacement,
      top: clampedTop,
      left: clampedLeft,
    };

    setPos((current) => {
      if (
        current
        && current.top === nextPlacement.top
        && current.left === nextPlacement.left
        && current.maxHeight === nextPlacement.maxHeight
      ) {
        return current;
      }

      return nextPlacement;
    });
  }, [anchorEl, anchorOrigin, open, overlayInsets.bottom, overlayInsets.top, transformOrigin]);

  React.useLayoutEffect(() => {
    if (!open) return;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!open && !keepMounted) return null;

  const viewportMax = pos
    ? pos.maxHeight
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
        ref={menuRef}
        role="menu"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose?.();
        }}
        style={{
          position: 'fixed',
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          zIndex: 1300,
          maxWidth: 'min(28rem, calc(100vw - 24px))',
          ...(resolvedMaxHeight !== undefined ? { maxHeight: resolvedMaxHeight } : {}),
          overflowY: 'auto',
          visibility: pos ? 'visible' : 'hidden',
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

/* ─── Popover ─────────────────────────────────────────── */
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
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const overlayInsets = getOverlayInsets();

  const updatePosition = React.useCallback(() => {
    if (!open || !anchorEl || !popoverRef.current || typeof window === 'undefined') return;
    const rect = anchorEl.getBoundingClientRect();
    const popoverEl = popoverRef.current;
    const popoverWidth =
      popoverEl.getBoundingClientRect().width || popoverEl.scrollWidth || 0;

    const top = rect.bottom + 4;
    const viewportLeft = VIEWPORT_GUTTER;
    const viewportRight = window.innerWidth - VIEWPORT_GUTTER;
    const maxLeft = Math.max(viewportRight - popoverWidth, viewportLeft);
    const left = clamp(rect.left, viewportLeft, maxLeft);

    setPos((current) => {
      if (current && current.top === top && current.left === left) return current;
      return { top, left };
    });
  }, [open, anchorEl]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
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
        ref={popoverRef}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose?.(); }}
        style={{
          position: 'fixed',
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          zIndex: 1300,
          maxHeight: pos
            ? window.innerHeight - pos.top - overlayInsets.bottom
            : window.innerHeight - overlayInsets.bottom,
          maxWidth: 'min(28rem, calc(100vw - 24px))',
          overflowY: 'auto',
          visibility: pos ? 'visible' : 'hidden',
        }}
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
