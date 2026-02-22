import React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

const ToastProvider = ToastPrimitive.Provider;
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999]',
      'flex flex-col gap-2 w-[360px] max-w-[90vw]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = 'ToastViewport';

/* ─── Snackbar (MUI-compat) ───────────────────────────── */
export interface SnackbarProps {
  open?: boolean;
  message?: React.ReactNode;
  autoHideDuration?: number | null;
  onClose?: (event: React.SyntheticEvent | Event | null, reason?: string) => void;
  anchorOrigin?: { vertical: 'top' | 'bottom'; horizontal: 'left' | 'center' | 'right' };
  action?: React.ReactNode;
  children?: React.ReactNode;
  TransitionComponent?: React.ElementType;
  ContentProps?: Record<string, unknown>;
  key?: React.Key;
}

const Snackbar: React.FC<SnackbarProps> = ({
  open = false,
  message,
  autoHideDuration = 6000,
  onClose,
  anchorOrigin = { vertical: 'bottom', horizontal: 'center' },
  action,
  children,
}) => {
  React.useEffect(() => {
    if (open && autoHideDuration) {
      const t = setTimeout(() => onClose?.(null, 'timeout'), autoHideDuration);
      return () => clearTimeout(t);
    }
  }, [open, autoHideDuration, onClose]);

  if (!open) return null;

  const posClass = cn(
    'fixed z-[9999]',
    anchorOrigin.vertical === 'top' ? 'top-4' : 'bottom-4',
    anchorOrigin.horizontal === 'left' ? 'left-4' :
    anchorOrigin.horizontal === 'right' ? 'right-4' :
    'left-1/2 -translate-x-1/2'
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(posClass, 'animate-slide-up')}
    >
      {children ?? (
        <div className="flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-[var(--radius-ui)] shadow-hard min-w-[280px] max-w-[400px]">
          <span className="flex-1 text-sm font-sans">{message}</span>
          {action && <div className="shrink-0">{action}</div>}
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => onClose?.(e, 'closeButton')}
            className="shrink-0 rounded p-1 opacity-70 hover:opacity-100 focus-visible:ring-2 ring-current outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export { Snackbar, ToastProvider, ToastViewport };
