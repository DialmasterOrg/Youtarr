import React from 'react';
import { cn } from '../../lib/cn';

type AsProp<C extends React.ElementType> = { as?: C };
type BoxOwnProps<C extends React.ElementType = 'div'> = AsProp<C> & {
  className?: string;
  children?: React.ReactNode;
  /** sx is accepted but ignored – convert to className when migrating */
  sx?: Record<string, unknown>;
};

type BoxProps<C extends React.ElementType = 'div'> = BoxOwnProps<C> &
  Omit<React.ComponentPropsWithRef<C>, keyof BoxOwnProps<C>>;

/**
 * Box – polymorphic layout primitive replacing MUI Box.
 * `sx` prop is accepted but intentionally dropped; use `className` with Tailwind instead.
 */
function Box<C extends React.ElementType = 'div'>(
  { as, className, sx: _sx, children, ...rest }: BoxProps<C>,
  ref: React.ForwardedRef<React.ElementRef<C>>
) {
  const Tag: React.ElementType = as ?? 'div';
  return (
    <Tag ref={ref} className={cn(className)} {...rest}>
      {children}
    </Tag>
  );
}

const BoxWithRef = React.forwardRef(Box) as <C extends React.ElementType = 'div'>(
  props: BoxProps<C>
) => React.ReactElement | null;

(BoxWithRef as any).displayName = 'Box';

export { BoxWithRef as Box };
export type { BoxProps };
