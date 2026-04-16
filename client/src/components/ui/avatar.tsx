import React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full select-none',
  {
    variants: {
      size: {
        small: 'h-8 w-8 text-xs',
        medium: 'h-10 w-10 text-sm',
        large: 'h-12 w-12 text-base',
      },
      variant: {
        circular: 'rounded-full',
        rounded: 'rounded-[var(--radius-ui)]',
        square: 'rounded-none',
      },
    },
    defaultVariants: {
      size: 'medium',
      variant: 'circular',
    },
  }
);

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  children?: React.ReactNode;
  imgProps?: { onError?: React.ReactEventHandler<HTMLImageElement>; [key: string]: any };
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, variant, src, alt, children, imgProps, ...props }, ref) => {
  const [imgError, setImgError] = React.useState(false);
  const showImage = !!src && !imgError;

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(avatarVariants({ size, variant }), 'bg-muted', className)}
      {...props}
    >
      {/* Use a native <img> so the element is always in the DOM (Radix's
          AvatarPrimitive.Image returns null in JSDOM because images never load). */}
      {src && (
        <img
          src={src}
          alt={alt}
          onError={(e) => {
            setImgError(true);
            imgProps?.onError?.(e);
          }}
          className={cn(
            'h-full w-full object-cover',
            !showImage && 'hidden'
          )}
        />
      )}
      {!showImage && (
        <AvatarPrimitive.Fallback
          className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground font-medium"
        >
          {children ??
            (alt
              ? alt
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : null)}
        </AvatarPrimitive.Fallback>
      )}
    </AvatarPrimitive.Root>
  );
});
Avatar.displayName = 'Avatar';

export { Avatar };
