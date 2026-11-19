import * as React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from '../../lib/cn';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Small trailing text, e.g. "current" */
  hint?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  'aria-label': string;
  /** lg: 44px touch targets */
  size?: 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

/**
 * A single-choice segmented control with radio semantics (radiogroup / radio,
 * arrow keys move between options). Theme-neutral: colors and corners come
 * from the theme tokens.
 */
export function SegmentedControl<T extends string>({
  value, onChange, options, size = 'md', disabled, className, 'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      role="radiogroup"
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        // Clicking the checked option would clear a single toggle group.
        if (next) onChange(next as T);
      }}
      className={cn('grid auto-cols-fr grid-flow-col gap-0.5 rounded-ui border border-border p-0.5', className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          role="radio"
          aria-checked={option.value === value}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-ui px-3 text-sm text-muted-foreground transition-colors',
            size === 'lg' ? 'min-h-[44px]' : 'min-h-[30px]',
            'data-[state=on]:bg-primary/10 data-[state=on]:font-semibold data-[state=on]:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {option.icon}
          <span>{option.label}</span>
          {option.hint ? <span className="text-[11px] font-normal text-muted-foreground">{option.hint}</span> : null}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
