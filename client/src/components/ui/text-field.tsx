import React, { useId } from 'react';
import { cn } from '../../lib/cn';

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  variant?: 'outlined' | 'filled' | 'standard';
  multiline?: boolean;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  InputProps?: {
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    readOnly?: boolean;
  };
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> & Record<`data-${string}`, string | number | boolean | undefined>;
  select?: boolean;
  SelectProps?: Record<string, unknown>;
  type?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
  margin?: string;
  InputLabelProps?: { shrink?: boolean; [key: string]: any };
}

/**
 * TextField - outlined variant with floating label.
 * Floating label: uses peer/:placeholder-shown CSS trick.
 * Label sits on border when floated, using bg-card to cut through.
 */
const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      helperText,
      error = false,
      fullWidth = false,
      size = 'medium',
      variant = 'outlined',
      multiline = false,
      rows,
      InputProps,
      inputProps: inputPropsExtra,
      className,
      disabled,
      required,
      id: externalId,
      value,
      defaultValue,
      placeholder,
      onChange,
      margin: _margin,
      InputLabelProps: _inputLabelProps,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const isSmall = size === 'small';
    const hasStartAdornment = !!InputProps?.startAdornment;
    const hasEndAdornment = !!InputProps?.endAdornment;

    const baseInputClass = cn(
      'peer w-full bg-transparent text-foreground outline-none placeholder-transparent',
      'border border-[var(--input-border)] hover:border-[var(--input-border-hover)]',
      'focus:border-primary focus:ring-1 focus:ring-primary',
      'rounded-[var(--radius-input)] transition-colors',
      isSmall ? 'px-3 py-1.5 text-sm' : 'px-3.5 py-2.5 text-base',
      hasStartAdornment && (isSmall ? 'pl-8' : 'pl-10'),
      hasEndAdornment && (isSmall ? 'pr-8' : 'pr-10'),
      error && 'border-destructive focus:border-destructive focus:ring-destructive',
      disabled && 'opacity-50 cursor-not-allowed bg-muted/30',
      InputProps?.readOnly && 'cursor-default',
      'font-sans',
    );

    const labelClass = cn(
      // Base: label floated (above border)
      'absolute left-3 -top-2.5 text-xs font-medium px-1',
      'bg-card rounded',
      // Text colors
      error ? 'text-destructive' : 'text-muted-foreground',
      'peer-focus:text-primary',
      error && 'peer-focus:text-destructive',
      // When input is empty and unfocused, label goes to mid-height
      'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2',
      'peer-placeholder-shown:text-base peer-placeholder-shown:font-normal',
      isSmall && 'peer-placeholder-shown:text-sm',
      // Transition
      'transition-all duration-150 pointer-events-none',
      // When focused, go back to floated
      'peer-focus:-top-2.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium',
      disabled && 'opacity-50',
    );

    const wrapperClass = cn(
      'relative',
      fullWidth ? 'w-full' : 'w-auto',
      className,
    );

    // Use a space placeholder when no placeholder is set, so that :placeholder-shown works for label
    const effectivePlaceholder = placeholder ?? ' ';

    if (multiline) {
      return (
        <div className={cn('flex flex-col gap-1', fullWidth && 'w-full')}>
          <div className={wrapperClass}>
            <textarea
              id={id}
              ref={ref as React.Ref<HTMLTextAreaElement>}
              disabled={disabled}
              required={required}
              rows={rows}
              placeholder={effectivePlaceholder}
              value={value as string | undefined}
              defaultValue={defaultValue as string | undefined}
              onChange={onChange as React.ChangeEventHandler<HTMLTextAreaElement>}
              className={cn(
                baseInputClass,
                'resize-y min-h-[80px]',
                'peer-placeholder-shown:top-2',
              )}
              {...(inputPropsExtra as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
            {label && (
              <label htmlFor={id} className={labelClass}>
                {label}{required && <span className="ml-0.5 text-destructive">*</span>}
              </label>
            )}
          </div>
          {helperText && (
            <p className={cn('text-xs px-3.5', error ? 'text-destructive' : 'text-muted-foreground')}>
              {helperText}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className={cn('flex flex-col gap-1', fullWidth && 'w-full')}>
        <div className={wrapperClass}>
          {InputProps?.startAdornment && (
            <span className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:h-5 [&>svg]:w-5',
              isSmall && '[&>svg]:h-4 [&>svg]:w-4',
            )}>
              {InputProps.startAdornment}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            required={required}
            aria-invalid={error ? 'true' : 'false'}
            placeholder={effectivePlaceholder}
            value={value}
            defaultValue={defaultValue}
            readOnly={InputProps?.readOnly}
            onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
            className={baseInputClass}
            {...inputPropsExtra}
            {...rest}
          />
          {label && (
            <label htmlFor={id} className={labelClass}>
              {label}{required && <span className="ml-0.5 text-destructive">*</span>}
            </label>
          )}
          {InputProps?.endAdornment && (
            <span className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:h-5 [&>svg]:w-5',
              isSmall && '[&>svg]:h-4 [&>svg]:w-4',
            )}>
              {InputProps.endAdornment}
            </span>
          )}
        </div>
        {helperText && (
          <p className={cn('text-xs px-3.5', error ? 'text-destructive' : 'text-muted-foreground')}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
TextField.displayName = 'TextField';

export { TextField };
