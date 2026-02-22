import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export type AlertSeverity = 'error' | 'warning' | 'info' | 'success';

const severityConfig: Record<AlertSeverity, { icon: React.ReactNode; classes: string }> = {
  error:   { icon: <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />, classes: 'bg-destructive/10 border-destructive/30 text-destructive dark:bg-destructive/20' },
  warning: { icon: <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />, classes: 'bg-warning/10 border-warning/30 text-warning' },
  info:    { icon: <Info className="h-5 w-5 shrink-0 mt-0.5" />, classes: 'bg-info/10 border-info/30 text-info' },
  success: { icon: <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />, classes: 'bg-success/10 border-success/30 text-success' },
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  severity?: AlertSeverity;
  variant?: 'filled' | 'outlined' | 'standard';
  onClose?: () => void;
  icon?: React.ReactNode | false;
  action?: React.ReactNode;
  sx?: Record<string, unknown>;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ severity = 'info', variant = 'standard', onClose, icon, action, className, children, sx: _sx, ...props }, ref) => {
    const config = severityConfig[severity];
    const showIcon = icon !== false;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'flex gap-3 rounded-[var(--radius-ui)] border px-4 py-3 text-sm font-sans',
          config.classes,
          className
        )}
        {...props}
      >
        {showIcon && <span>{icon ?? config.icon}</span>}
        <div className="flex-1 min-w-0">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mt-0.5 -mr-1 rounded p-1 opacity-60 hover:opacity-100 focus-visible:ring-2 ring-current outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);
Alert.displayName = 'Alert';

/* AlertTitle – bold first line inside Alert */
const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn('font-bold mb-0.5 leading-snug', className)} {...props}>
      {children}
    </p>
  )
);
AlertTitle.displayName = 'AlertTitle';

export { Alert, AlertTitle };
