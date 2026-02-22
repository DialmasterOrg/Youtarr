import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/cn';

const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  title?: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  arrow?: boolean;
  disableHoverListener?: boolean;
  enterDelay?: number;
  className?: string;
  sx?: Record<string, unknown>;
}

const Tooltip: React.FC<TooltipProps> = ({
  title,
  children,
  placement = 'top',
  arrow = false,
  disableHoverListener = false,
  enterDelay = 200,
  className,
}) => {
  if (!title || disableHoverListener) return children;

  const side = placement.split('-')[0] as 'top' | 'bottom' | 'left' | 'right';
  const align = placement.includes('-start') ? 'start' : placement.includes('-end') ? 'end' : 'center';

  return (
    <TooltipPrimitive.Root delayDuration={enterDelay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={arrow ? 4 : 6}
          className={cn(
            'z-50 max-w-xs rounded-md bg-foreground px-2.5 py-1.5',
            'text-xs font-medium text-background leading-snug',
            'shadow-lg animate-fade-in',
            'select-none break-words',
            className
          )}
        >
          {title}
          {arrow && <TooltipPrimitive.Arrow className="fill-foreground" />}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};

export { Tooltip, TooltipProvider };
