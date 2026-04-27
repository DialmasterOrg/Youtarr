import React, { useRef } from 'react';
import { Calendar, Close as CloseIcon } from '../../../../lib/icons';
import { cn } from '../../../../lib/cn';

export interface DatePickerButtonProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  clearAriaLabel?: string;
  minWidth?: number | string;
}

function formatShortDate(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return '';
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

function DatePickerButton({
  value,
  onChange,
  placeholder = 'Pick date',
  ariaLabel,
  clearAriaLabel,
  minWidth,
}: DatePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    const picker = (input as HTMLInputElement & { showPicker?: () => void }).showPicker;
    if (typeof picker === 'function') {
      try {
        picker.call(input);
        return;
      } catch {
        // fall through to focus/click fallback
      }
    }
    input.focus();
    input.click();
  };

  return (
    <div
      style={minWidth ? { minWidth } : undefined}
      className={cn(
        'relative inline-flex items-center gap-1 pl-3 pr-1 min-h-[36px] text-sm',
        'rounded-[var(--radius-input)] border border-[var(--input-border,var(--border))]',
        'bg-[var(--card)] text-foreground',
        'focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
        'transition-colors',
      )}
    >
      <button
        type="button"
        onClick={openPicker}
        aria-label={ariaLabel}
        className="flex-1 inline-flex items-center gap-2 py-1.5 bg-transparent border-0 outline-none text-left cursor-pointer"
      >
        <Calendar size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        <span className={cn('leading-none', !value && 'text-muted-foreground')}>
          {value ? formatShortDate(value) : placeholder}
        </span>
      </button>
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={clearAriaLabel ?? 'Clear date'}
          className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <CloseIcon size={14} aria-hidden="true" />
        </button>
      ) : (
        <span className="w-1" aria-hidden="true" />
      )}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />
    </div>
  );
}

export default DatePickerButton;
