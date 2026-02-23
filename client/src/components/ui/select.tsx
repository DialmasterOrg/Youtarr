import React, { useId } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export type SelectChangeEvent<T = string> = { target: { value: T; name?: string } };

/* ─── Radix-based Select ──────────────────────────────── */
export interface SelectProps {
  value?: string;
  defaultValue?: string;
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
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({
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
    labelId: _labelId,
    notched: _notched,
  }, ref) => {
    const isSmall = size === 'small';

    const handleValueChange = (val: string) => {
      onValueChange?.(val);
      onChange?.({ target: { value: val, name } });
    };

    return (
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          ref={ref}
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
          <SelectPrimitive.Value placeholder={placeholder} />
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
              'rounded-[var(--radius-ui)]',
              'border-[length:var(--border-weight)] border-[var(--border-strong)]',
              'bg-popover text-popover-foreground shadow-hard',
              'data-[state=open]:animate-slide-down data-[state=closed]:animate-fade-in',
            )}
          >
            <SelectPrimitive.Viewport className="p-1">
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
  value?: string;
  selected?: boolean;
  dense?: boolean;
  disableGutters?: boolean;
  divider?: boolean;
}

const MenuItem = React.forwardRef<HTMLDivElement, MenuItemProps>(
  ({ value, selected, dense, disableGutters, divider, className, children, onClick, ...props }, ref) => {
    if (value !== undefined) {
      // Render as Radix SelectItem when inside a Select
      return (
        <SelectPrimitive.Item
          value={value}
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
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e as any); } }}
        className={cn(
          'flex items-center gap-2 rounded-md cursor-pointer select-none outline-none',
          'text-sm font-sans text-foreground',
          !disableGutters && 'px-3 py-1.5',
          'hover:bg-muted focus:bg-muted',
          'transition-colors',
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
