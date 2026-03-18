import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

const DialogRoot = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DialogCompatContext = React.createContext(false);

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[1450] bg-black/50 backdrop-blur-sm',
      'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-in',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  fullScreen?: boolean;
  PaperProps?: { sx?: Record<string, unknown>; className?: string };
}

const maxWidthMap: Record<string, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, maxWidth: _maxWidth, fullWidth: _fullWidth, fullScreen: _fullScreen, PaperProps: _PaperProps, ...props }, ref) => (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn('flex-1 overflow-y-auto px-6 py-4 text-sm', className)}
      {...(props as React.HTMLAttributes<HTMLDivElement>)}
    >
      {children}
    </div>
  )
);
DialogContent.displayName = 'DialogContent';

/* ─── Dialog wrapper ──────────────────────────────────── */
export interface DialogProps {
  open: boolean;
  onClose?: (event: {}, reason?: 'backdropClick' | 'escapeKeyDown') => void;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullWidth?: boolean;
  fullScreen?: boolean;
  PaperProps?: { sx?: Record<string, unknown>; className?: string };
  BackdropProps?: Record<string, any>;
  children?: React.ReactNode;
  className?: string;
  disableEscapeKeyDown?: boolean;
  [key: string]: any;
}

const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  maxWidth = 'sm',
  fullWidth = false,
  fullScreen = false,
  PaperProps,
  BackdropProps: backdropProps,
  children,
  className,
  disableEscapeKeyDown = false,
  ...contentProps
}) => (
  <DialogRoot
    open={open}
    onOpenChange={(o) => { if (!o) onClose?.({}, 'backdropClick'); }}
  >
    <DialogCompatContext.Provider value>
      <DialogPortal>
        <DialogOverlay onClick={() => onClose?.({}, 'backdropClick')} {...(backdropProps || {})} />
        <DialogPrimitive.Content
          aria-describedby={contentProps['aria-describedby'] ?? undefined}
          className={cn(
            'fixed z-[1460] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'bg-card text-foreground',
            'rounded-[var(--radius-ui)]',
            'border-[length:var(--border-weight)] border-[var(--border-strong)]',
            'shadow-2xl',
            'flex flex-col overflow-hidden',
            'focus-visible:outline-none',
            'data-[state=open]:animate-slide-up',
            !fullScreen && maxWidth && maxWidthMap[maxWidth],
            !fullScreen && fullWidth && 'w-[calc(100vw-48px)]',
            fullScreen && 'inset-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none rounded-none',
            PaperProps?.className,
            className
          )}
          style={{
            maxHeight: 'calc(100dvh - var(--mobile-nav-total-offset, 0px) - 80px)',
          }}
          onEscapeKeyDown={(e) => { if (disableEscapeKeyDown) e.preventDefault(); else onClose?.({}, 'escapeKeyDown'); }}
          onInteractOutside={(e) => { e.preventDefault(); }}
          {...contentProps}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogCompatContext.Provider>
  </DialogRoot>
);

const DialogTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void }>(
  ({ className, children, onClose, ...props }, ref) => {
    const isInsideDialog = React.useContext(DialogCompatContext);
    const titleContent = isInsideDialog ? (
      <DialogPrimitive.Title asChild>
        <span className="flex-1">{children}</span>
      </DialogPrimitive.Title>
    ) : (
      <span className="flex-1">{children}</span>
    );

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2 px-6 py-4 border-b border-border font-display font-bold text-lg text-foreground', className)}
        {...props}
      >
        {titleContent}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 opacity-60 hover:opacity-100 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    );
  }
);
DialogTitle.displayName = 'DialogTitle';

const DialogContentBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex-1 overflow-y-auto px-6 py-4 text-sm', className)} {...props}>
      {children}
    </div>
  )
);
DialogContentBody.displayName = 'DialogContentBody';

const DialogContentText = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  )
);
DialogContentText.displayName = 'DialogContentText';

const DialogActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center justify-end gap-2 px-6 py-3 border-t border-border', className)} {...props}>
      {children}
    </div>
  )
);
DialogActions.displayName = 'DialogActions';

export {
  Dialog,
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogContentBody,
  DialogContentText,
  DialogActions,
};
