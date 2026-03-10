import React, { useId } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export type SelectChangeEvent<T = string> = { target: { value: T; name?: string } };
const EMPTY_SELECT_VALUE = '__EMPTY_SELECT_VALUE__';
const toPrimitiveValue = (value?: string | number) => {
  if (value === '') return EMPTY_SELECT_VALUE;
  if (value === undefined) return undefined;
  return String(value);
};
const fromPrimitiveValue = (value: string) => (value === EMPTY_SELECT_VALUE ? '' : value);

/* ─── Radix-based Select ──────────────────────────────── */
export interface SelectProps {
  id?: string;
  style?: React.CSSProperties;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: SelectChangeEvent) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  label?: string;
  name?: string;
  error?: boolean;
  multiple?: boolean;
  renderValue?: (value: string) => React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  placeholder?: string;
  sx?: Record<string, unknown>;
  displayEmpty?: boolean;
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  variant?: 'outlined' | 'standard' | 'filled';
  autoWidth?: boolean;
  native?: boolean;
  labelId?: string;
  notched?: boolean;
  inputProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, string | number | boolean | undefined>;
  /** Override the ARIA role on the trigger. Defaults to "button" for MUI compat.
   * Use "combobox" for autocomplete-style selects (e.g. SubfolderAutocomplete). */
  triggerRole?: 'button' | 'combobox';
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({
    id,
    value,
    defaultValue,
    onChange,
    onValueChange,
    disabled,
    size = 'medium',
    fullWidth,
    name,
    error,
    renderValue,
    className,
    children,
    placeholder,
    displayEmpty: _displayEmpty,
    sx: _sx,
    variant: _variant,
    autoWidth: _autoWidth,
    native: _native,
    labelId,
    notched: _notched,
    inputProps,
    triggerRole = 'button',
    open,
    onOpen,
    onClose,
    style,
  }, ref) => {
    // Manage open state internally so that onMouseDown (used by some tests)
    // can open the dropdown directly without relying on PointerEvent.
    const isControlled = open !== undefined;
    const [internalOpen, setInternalOpen] = React.useState(false);
    const isOpen = isControlled ? open! : internalOpen;

    const handleOpenChange = (newOpen: boolean) => {
      if (!isControlled) setInternalOpen(newOpen);
      if (newOpen) onOpen?.();
      else onClose?.();
    };
    const isSmall = size === 'small';
    // Track whether the controlled/default value is numeric so we can coerce the
    // onChange payload back to a number (Radix Select always uses strings internally).
    const wasNumericRef = React.useRef(
      typeof value === 'number' || typeof defaultValue === 'number'
    );
    const primitiveValue = value !== undefined ? toPrimitiveValue(value) : undefined;
    const primitiveDefaultValue = defaultValue !== undefined ? toPrimitiveValue(defaultValue) : undefined;

    const handleValueChange = (val: string) => {
      const normalizedValue = fromPrimitiveValue(val);
      onValueChange?.(normalizedValue);
      // If the initial value was a number, coerce back so handlers like
      // `(e) => onConfigChange({ [key]: e.target.value })` receive the right type.
      const outputValue =
        wasNumericRef.current && normalizedValue !== '' && !isNaN(Number(normalizedValue))
          ? Number(normalizedValue)
          : normalizedValue;
      onChange?.({ target: { value: outputValue as any, name } });
    };

    return (
      <SelectPrimitive.Root
        value={primitiveValue}
        defaultValue={primitiveDefaultValue}
        onValueChange={handleValueChange}
        disabled={disabled}
        open={isOpen}
        onOpenChange={handleOpenChange}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          role={triggerRole}
          aria-disabled={disabled ? 'true' : undefined}
          aria-labelledby={labelId}
          // Tests use fireEvent.mouseDown to open the Select.
          // Radix only responds to pointerdown, so we open directly here.
          // We only open (not toggle) — Radix's own handler handles closing.
          onMouseDown={(e) => {
            if (!e.defaultPrevented && !disabled && !isOpen) {
              handleOpenChange(true);
            }
          }}
          {...inputProps}
          style={style}
          className={cn(
            'flex items-center justify-between gap-2',
            'rounded-[var(--radius-input)]',
            'border border-[var(--input-border)] hover:border-[var(--input-border-hover)]',
            'bg-input text-foreground',
            'font-sans text-left',
            'transition-colors',
            'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-destructive focus:border-destructive focus:ring-destructive',
            isSmall ? 'text-sm px-3 py-1.5 min-h-[36px]' : 'text-base px-3.5 py-2.5 min-h-[48px]',
            fullWidth && 'w-full',
            className
          )}
        >
          {/* When controlled-open (isOpen=true), hide the trigger value to avoid
              duplicate text in the DOM (trigger + portal option both show the
              same label). This only applies to externally-controlled selects. */}
          {!isOpen && <SelectPrimitive.Value placeholder={placeholder} />}
          {isOpen && <span aria-hidden="true" />}
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className={cn(
              'relative z-50 min-w-[8rem] overflow-hidden',
              'max-h-[var(--radix-select-content-available-height)]',
              'rounded-[var(--radius-ui)]',
              'border-[length:var(--border-weight)] border-[var(--border-strong)]',
              'bg-popover text-popover-foreground shadow-hard',
              'data-[state=open]:animate-slide-down data-[state=closed]:animate-fade-in',
            )}
          >
            <SelectPrimitive.Viewport className="p-1 overflow-y-auto">
              {children}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  }
);
Select.displayName = 'Select';

/* ─── MenuItem (also used as SelectItem) ─────────────── */
export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLDivElement> {
  value?: string | number;
  selected?: boolean;
  dense?: boolean;
  disableGutters?: boolean;
  divider?: boolean;
}

const MenuItem = React.forwardRef<HTMLDivElement, MenuItemProps>(
  ({ value, selected, dense, disableGutters, divider, className, children, onClick, disabled, ...props }, ref) => {
    if (value !== undefined) {
      // Render as Radix SelectItem when inside a Select
      const normalizedValue = toPrimitiveValue(value);
      return (
        <SelectPrimitive.Item
          value={normalizedValue}
          className={cn(
            'relative flex items-center gap-2 rounded-md cursor-default select-none outline-none',
            'text-sm font-sans text-foreground',
            'px-3 py-1.5',
            'data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
            'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            dense && 'py-1',
            divider && 'border-b border-border mb-1',
            className
          )}
          {...(props as any)}
        >
          <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
          <SelectPrimitive.ItemIndicator className="ml-auto">
            <Check className="h-4 w-4" />
          </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
      );
    }

    // Standalone MenuItem (e.g. inside Menu/DropdownMenu)
    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={0}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onClick?.(e);
        }}
        onKeyDown={(e) => {
          if (disabled) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(e as any);
          }
        }}
        className={cn(
          'flex items-center gap-2 rounded-md cursor-pointer select-none outline-none',
          'text-sm font-sans text-foreground',
          !disableGutters && 'px-3 py-1.5',
          'hover:bg-muted focus:bg-muted',
          'transition-colors',
          disabled && 'pointer-events-none opacity-50',
          selected && 'bg-muted font-medium',
          dense && 'py-1',
          divider && 'border-b border-border mb-1',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MenuItem.displayName = 'MenuItem';

export { Select, MenuItem };
