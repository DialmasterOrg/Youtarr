import React from 'react';
import { cn } from '../../lib/cn';

/* ─── Grid Container ──────────────────────────────────── */
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  container?: boolean;
  item?: boolean;
  spacing?: number | string;
  xs?: number | 'auto' | boolean;
  sm?: number | 'auto' | boolean;
  md?: number | 'auto' | boolean;
  lg?: number | 'auto' | boolean;
  xl?: number | 'auto' | boolean;
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  sx?: Record<string, unknown>;
  component?: React.ElementType;
  paddingBottom?: string | number;
}

const colMap: Record<number, string> = {
  1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4',
  5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8',
  9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12',
};
const smColMap: Record<number, string> = {
  1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4',
  5: 'sm:col-span-5', 6: 'sm:col-span-6', 7: 'sm:col-span-7', 8: 'sm:col-span-8',
  9: 'sm:col-span-9', 10: 'sm:col-span-10', 11: 'sm:col-span-11', 12: 'sm:col-span-12',
};
const mdColMap: Record<number, string> = {
  1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4',
  5: 'md:col-span-5', 6: 'md:col-span-6', 7: 'md:col-span-7', 8: 'md:col-span-8',
  9: 'md:col-span-9', 10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12',
};
const lgColMap: Record<number, string> = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4',
  5: 'lg:col-span-5', 6: 'lg:col-span-6', 7: 'lg:col-span-7', 8: 'lg:col-span-8',
  9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
};
const spacingMap: Record<number, string> = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4',
  5: 'gap-5', 6: 'gap-6', 8: 'gap-8',
};

const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      container,
      item: _item,
      spacing,
      xs,
      sm,
      md,
      lg,
      direction,
      wrap,
      alignItems,
      justifyContent,
      className,
      children,
      sx: _sx,
      component: Component = 'div',
      paddingBottom,
      style,
      ...props
    },
    ref
  ) => {
    const classes: string[] = [];

    if (container) {
      classes.push('grid grid-cols-12');
      if (spacing !== undefined) {
        classes.push(spacingMap[Number(spacing)] ?? `gap-${spacing}`);
      } else {
        classes.push('gap-4');
      }
      if (direction === 'column') classes.push('grid-flow-col');
      if (wrap === 'nowrap') classes.push('flex-nowrap');
      if (alignItems === 'center') classes.push('items-center');
      else if (alignItems === 'flex-end') classes.push('items-end');
      else if (alignItems === 'flex-start') classes.push('items-start');
      if (justifyContent === 'center') classes.push('justify-center');
      else if (justifyContent === 'flex-end') classes.push('justify-end');
      else if (justifyContent === 'space-between') classes.push('justify-between');
      else if (justifyContent === 'space-around') classes.push('justify-around');
    }

    if (xs === true || xs === 12) classes.push('col-span-12');
    else if (xs === 'auto') classes.push('col-auto');
    else if (typeof xs === 'number' && colMap[xs]) classes.push(colMap[xs]);

    if (sm === true || sm === 12) classes.push('sm:col-span-12');
    else if (sm === 'auto') classes.push('sm:col-auto');
    else if (typeof sm === 'number' && smColMap[sm]) classes.push(smColMap[sm]);

    if (md === true || md === 12) classes.push('md:col-span-12');
    else if (md === 'auto') classes.push('md:col-auto');
    else if (typeof md === 'number' && mdColMap[md]) classes.push(mdColMap[md]);

    if (lg === true || lg === 12) classes.push('lg:col-span-12');
    else if (lg === 'auto') classes.push('lg:col-auto');
    else if (typeof lg === 'number' && lgColMap[lg]) classes.push(lgColMap[lg]);

    return React.createElement(
      Component as string,
      { ref, className: cn(...classes, className), style: { paddingBottom, ...style }, ...props },
      children
    );
  }
);
Grid.displayName = 'Grid';

export { Grid };
