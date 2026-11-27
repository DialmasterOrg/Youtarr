import React from 'react';
import { cn } from '../../lib/cn';

export const REMOTE_THUMB_WIDTH = 120;
export const REMOTE_THUMB_HEIGHT = 67;

const SIZE = { width: REMOTE_THUMB_WIDTH, height: REMOTE_THUMB_HEIGHT };

interface RemoteThumbnailProps {
  // A thumbnail YouTube serves; a missing one leaves the placeholder box.
  src?: string | null;
  className?: string;
  children?: React.ReactNode;
}

function RemoteThumbnail({ src, className = 'inline-block', children }: RemoteThumbnailProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[var(--media-placeholder-background)] rounded-[var(--radius-thumb)]',
        className
      )}
      style={SIZE}
    >
      {src && (
        <img
          src={src}
          alt=""
          className="block object-cover rounded-[var(--radius-thumb)]"
          style={SIZE}
          loading="lazy"
        />
      )}
      {children}
    </div>
  );
}

export default RemoteThumbnail;
