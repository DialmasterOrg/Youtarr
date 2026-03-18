import React from 'react';
import { cn } from '../../lib/cn';

/* ─── Grow ─────────────────────────────────────────────
  Scale + fade transition implemented with CSS transitions.
──────────────────────────────────────────────────────── */
export interface GrowProps {
  in?: boolean;
  children: React.ReactElement;
  timeout?: number | { enter?: number; exit?: number };
  unmountOnExit?: boolean;
  mountOnEnter?: boolean;
  style?: React.CSSProperties;
}

const Grow: React.FC<GrowProps> = ({
  in: inProp = false,
  children,
  timeout = 300,
  unmountOnExit = false,
  mountOnEnter = false,
  style,
}) => {
  const duration = typeof timeout === 'number' ? timeout : (timeout.enter ?? 300);
  const [mounted, setMounted] = React.useState(!mountOnEnter || inProp);
  const [visible, setVisible] = React.useState(inProp);

  React.useEffect(() => {
    if (inProp) {
      setMounted(true);
      // Defer to next frame so CSS transition fires
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      if (unmountOnExit) {
        const id = setTimeout(() => setMounted(false), duration);
        return () => clearTimeout(id);
      }
    }
  }, [inProp, unmountOnExit, duration]);

  if (!mounted) return null;

  return React.cloneElement(children, {
    style: {
      transition: `transform ${duration}ms cubic-bezier(0.4,0,0.2,1), opacity ${duration}ms cubic-bezier(0.4,0,0.2,1)`,
      transform: visible ? 'scale(1)' : 'scale(0.75)',
      opacity: visible ? 1 : 0,
      ...style,
      ...(children.props.style ?? {}),
    },
  });
};

/* ─── Slide ─────────────────────────────────────────────
  Directional translate transition.
──────────────────────────────────────────────────────── */
export interface SlideProps {
  in?: boolean;
  direction?: 'up' | 'down' | 'left' | 'right';
  children: React.ReactElement;
  timeout?: number | { enter?: number; exit?: number };
  unmountOnExit?: boolean;
  mountOnEnter?: boolean;
}

const directionTransform: Record<string, string> = {
  up: 'translateY(100%)',
  down: 'translateY(-100%)',
  left: 'translateX(100%)',
  right: 'translateX(-100%)',
};

const Slide: React.FC<SlideProps> = ({
  in: inProp = false,
  direction = 'down',
  children,
  timeout = 300,
  unmountOnExit = false,
  mountOnEnter = false,
}) => {
  const duration = typeof timeout === 'number' ? timeout : (timeout.enter ?? 300);
  const [mounted, setMounted] = React.useState(!mountOnEnter || inProp);
  const [visible, setVisible] = React.useState(inProp);

  React.useEffect(() => {
    if (inProp) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      if (unmountOnExit) {
        const id = setTimeout(() => setMounted(false), duration);
        return () => clearTimeout(id);
      }
    }
  }, [inProp, unmountOnExit, duration]);

  if (!mounted) return null;

  return React.cloneElement(children, {
    style: {
      transition: `transform ${duration}ms cubic-bezier(0.4,0,0.2,1), opacity ${duration}ms cubic-bezier(0.4,0,0.2,1)`,
      transform: visible ? 'translateX(0) translateY(0)' : directionTransform[direction],
      opacity: visible ? 1 : 0,
      ...(children.props.style ?? {}),
    },
  });
};

/* ─── Fade ─────────────────────────────────────────────── */
export interface FadeProps {
  in?: boolean;
  children: React.ReactElement;
  timeout?: number;
  unmountOnExit?: boolean;
}

const Fade: React.FC<FadeProps> = ({
  in: inProp = false,
  children,
  timeout = 300,
  unmountOnExit = false,
}) => {
  const [mounted, setMounted] = React.useState(inProp);
  const [visible, setVisible] = React.useState(inProp);

  React.useEffect(() => {
    if (inProp) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      if (unmountOnExit) {
        const id = setTimeout(() => setMounted(false), timeout);
        return () => clearTimeout(id);
      }
    }
  }, [inProp, unmountOnExit, timeout]);

  if (!mounted) return null;

  return React.cloneElement(children, {
    style: {
      transition: `opacity ${timeout}ms ease`,
      opacity: visible ? 1 : 0,
      ...(children.props.style ?? {}),
    },
  });
};

/* ─── Collapse ─────────────────────────────────────────── */
export interface CollapseProps {
  in?: boolean;
  children: React.ReactNode;
  timeout?: number | 'auto';
  unmountOnExit?: boolean;
  className?: string;
}

const Collapse: React.FC<CollapseProps> = ({
  in: inProp = false,
  children,
  timeout = 300,
  unmountOnExit = false,
  className,
}) => {
  const duration = timeout === 'auto' ? 300 : timeout;
  const [mounted, setMounted] = React.useState(inProp);
  const [height, setHeight] = React.useState<number | 'auto'>(inProp ? 'auto' : 0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (inProp) {
      setMounted(true);
      const el = containerRef.current;
      if (el) {
        // Already mounted in DOM — animate height immediately
        setHeight(el.scrollHeight);
        const id = setTimeout(() => setHeight('auto'), duration);
        return () => clearTimeout(id);
      }
      // If el is null the component was previously unmounted (unmountOnExit=true).
      // The layout effect below will set the height once the DOM node exists.
    } else {
      if (containerRef.current) {
        setHeight(containerRef.current.scrollHeight);
        // Force reflow then collapse
        requestAnimationFrame(() => setHeight(0));
      } else {
        setHeight(0);
      }
      if (unmountOnExit) {
        const id = setTimeout(() => setMounted(false), duration);
        return () => clearTimeout(id);
      }
    }
  }, [inProp, unmountOnExit, duration]);

  // After re-mounting from an unmounted state (unmountOnExit=true), the DOM node
  // becomes available but the useEffect above already ran with containerRef=null.
  // This layout effect fires synchronously after the DOM is painted and sets the
  // height so the expansion animation plays correctly.
  React.useLayoutEffect(() => {
    if (inProp && mounted && height === 0 && containerRef.current) {
      const h = containerRef.current.scrollHeight;
      setHeight(h);
      const id = setTimeout(() => setHeight('auto'), duration);
      return () => clearTimeout(id);
    }
  // Only fire when `mounted` flips to true — other deps are intentionally omitted
  // because they are stable within this transition window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className={cn('overflow-hidden', className)}
      style={{
        height: height === 'auto' ? 'auto' : `${height}px`,
        transition: height !== 'auto' ? `height ${duration}ms cubic-bezier(0.4,0,0.2,1)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

/* ─── Backdrop ─────────────────────────────────────────── */
export interface BackdropProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  invisible?: boolean;
}

const Backdrop: React.FC<BackdropProps> = ({
  open = false,
  invisible = false,
  className,
  children,
  onClick,
  ...props
}) => {
  if (!open) return null;
  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex items-center justify-center',
        !invisible && 'bg-black/50',
        className
      )}
      onClick={onClick}
      aria-hidden="true"
      {...props}
    >
      {children}
    </div>
  );
};

/* ─── Zoom ─────────────────────────────────────────────
   Scale transition. Simple passthrough for our usage.
──────────────────────────────────────────────────────── */
export interface ZoomProps {
  in?: boolean;
  children: React.ReactElement;
  timeout?: number;
}

const Zoom: React.FC<ZoomProps> = ({ in: inProp = true, children }) => {
  return inProp ? children : null;
};

export { Grow, Slide, Fade, Collapse, Backdrop, Zoom };
