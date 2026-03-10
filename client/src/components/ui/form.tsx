import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

/* ─── Switch ──────────────────────────────────────────── */
export interface SwitchProps extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, 'onChange'> {
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  color?: string;
  /** MUI-compatible: data-testid and other input-level attributes forwarded to the root element */
  inputProps?: React.HTMLAttributes<HTMLElement> & { 'data-testid'?: string };
}

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  ({ checked, onChange, size = 'medium', color: _color, inputProps, className, name, ...props }, ref) => {
    const isSmall = size === 'small';
    return (
      <SwitchPrimitive.Root
        ref={ref}
        checked={checked}
        name={name}
        // Tests (and MUI compat) expect role="checkbox", not role="switch"
        role="checkbox"
        data-testid={inputProps?.['data-testid']}
        onCheckedChange={(v) =>
          onChange?.({ target: { checked: v, name: name } } as React.ChangeEvent<HTMLInputElement>)
        }
        className={cn(
          'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted',
          isSmall ? 'h-5 w-9' : 'h-6 w-11',
          className
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'pointer-events-none block rounded-full bg-white shadow-md ring-0',
            'transition-transform data-[state=checked]:translate-x-full data-[state=unchecked]:translate-x-0',
            isSmall ? 'h-4 w-4 data-[state=checked]:translate-x-4' : 'h-5 w-5 data-[state=checked]:translate-x-5'
          )}
        />
      </SwitchPrimitive.Root>
    );
  }
);
Switch.displayName = 'Switch';

/* ─── Checkbox ────────────────────────────────────────── */
export interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'onChange'> {
  checked?: boolean | 'indeterminate';
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  size?: 'small' | 'medium';
  color?: string;
  indeterminate?: boolean;
  /** MUI-compatible: data-testid and other input-level attributes forwarded to the root element */
  inputProps?: React.HTMLAttributes<HTMLElement> & { 'data-testid'?: string };
}

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ checked, onChange, size = 'medium', color: _color, indeterminate, inputProps, className, name, ...props }, ref) => {
    const isSmall = size === 'small';
    const effectiveChecked = indeterminate ? 'indeterminate' : checked;
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        checked={effectiveChecked}
        name={name}
        data-indeterminate={indeterminate ? 'true' : undefined}
        data-testid={inputProps?.['data-testid']}
        aria-label={inputProps?.['aria-label'] as string | undefined}
        onCheckedChange={(v) =>
          onChange?.({
            target: { checked: v === true, name: name },
            stopPropagation: () => {},
            preventDefault: () => {},
          } as unknown as React.ChangeEvent<HTMLInputElement>)
        }
        className={cn(
          'peer shrink-0 rounded border-2 border-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
          'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
          'data-[state=unchecked]:bg-transparent',
          isSmall ? 'h-4 w-4' : 'h-5 w-5',
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
          {effectiveChecked === 'indeterminate'
            ? <div className={isSmall ? 'h-0.5 w-2.5 bg-current rounded' : 'h-0.5 w-3 bg-current rounded'} />
            : <Check className={isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={3} />}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  }
);
Checkbox.displayName = 'Checkbox';

/* ─── FormControlLabel ────────────────────────────────── */
export interface FormControlLabelProps extends Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'children'> {
  control: React.ReactElement;
  label: React.ReactNode;
  labelPlacement?: 'end' | 'start' | 'top' | 'bottom';
  disabled?: boolean;
  value?: unknown;
}

const FormControlLabel = React.forwardRef<HTMLLabelElement, FormControlLabelProps>(
  ({ control, label, labelPlacement = 'end', disabled, className, ...props }, ref) => {
    const generatedId = React.useId();
    const controlId = (control.props as any).id ?? generatedId;
    return (
      <label
        ref={ref}
        htmlFor={controlId}
        className={cn(
          'inline-flex items-center gap-2 cursor-pointer select-none font-sans text-sm text-foreground',
          labelPlacement === 'start' && 'flex-row-reverse',
          labelPlacement === 'top' && 'flex-col-reverse items-center gap-1',
          labelPlacement === 'bottom' && 'flex-col items-center gap-1',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {React.cloneElement(control, { id: controlId, disabled: disabled ?? (control.props as any).disabled })}
        <span>{label}</span>
      </label>
    );
  }
);
FormControlLabel.displayName = 'FormControlLabel';

/* ─── FormControl ─────────────────────────────────────── */
const FormControl = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { error?: boolean; disabled?: boolean; fullWidth?: boolean }>(
  ({ className, fullWidth, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1', fullWidth && 'w-full', className)} {...props}>
      {children}
    </div>
  )
);
FormControl.displayName = 'FormControl';

/* ─── FormHelperText ──────────────────────────────────── */
const FormHelperText = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement> & { error?: boolean }>(
  ({ className, error, children, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs px-0.5', error ? 'text-destructive' : 'text-muted-foreground', className)} {...props}>
      {children}
    </p>
  )
);
FormHelperText.displayName = 'FormHelperText';

/* ─── InputLabel ──────────────────────────────────────── */
const InputLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement> & { shrink?: boolean; required?: boolean; error?: boolean }>(
  ({ className, shrink: _shrink, required, error, children, ...props }, ref) => (
    <label ref={ref} className={cn('text-xs font-medium text-muted-foreground', error && 'text-destructive', className)} {...props}>
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  )
);
InputLabel.displayName = 'InputLabel';

/* ─── Radio ───────────────────────────────────────────── */
const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & { onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }
>(({ onChange, onValueChange, className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    onValueChange={(v) => {
      onValueChange?.(v);
      onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>);
    }}
    className={cn('flex flex-col gap-2', className)}
    {...props}
  />
));
RadioGroup.displayName = 'RadioGroup';

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'aspect-square h-4 w-4 rounded-full border-2 border-primary text-primary',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <div className="h-2 w-2 rounded-full bg-primary" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = 'RadioGroupItem';

export {
  Switch,
  Checkbox,
  FormControlLabel,
  FormControl,
  FormHelperText,
  InputLabel,
  RadioGroup,
  RadioGroupItem,
};
