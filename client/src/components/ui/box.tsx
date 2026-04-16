import React from 'react';
import { cn } from '../../lib/cn';

type AsProp<C extends React.ElementType> = { as?: C };
type BoxOwnProps<C extends React.ElementType = 'div'> = AsProp<C> & {
  className?: string;
  children?: React.ReactNode;
  component?: C;
  display?: string;
  width?: string | number;
  fontWeight?: string | number;
  paddingBottom?: string | number;
};

type BoxProps<C extends React.ElementType = 'div'> = BoxOwnProps<C> &
  Omit<React.ComponentPropsWithRef<C>, keyof BoxOwnProps<C>>;

/**
 * Box – polymorphic layout primitive. Use `className` with Tailwind for styling.
 */
function Box<C extends React.ElementType = 'div'>(
  { as, component, className, display: _display, width: _width, fontWeight: _fw, paddingBottom: _pb, children, ...rest }: BoxProps<C>,
  ref: React.ForwardedRef<React.ElementRef<C>>
) {
  const Tag: React.ElementType = as ?? component ?? 'div';
  return (
    <Tag ref={ref} className={cn(className)} {...rest}>
      {children}
    </Tag>
  );
}

const BoxWithRef = React.forwardRef(Box) as <C extends React.ElementType = 'div'>(
  props: BoxProps<C>
) => React.ReactElement | null;

(BoxWithRef as { displayName?: string }).displayName = 'Box';

export { BoxWithRef as Box };
export type { BoxProps };
