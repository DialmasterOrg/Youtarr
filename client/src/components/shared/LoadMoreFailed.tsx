import React from 'react';
import { Button, Typography } from '../ui';

interface LoadMoreFailedProps {
  message: string;
  onRetry: () => void;
}

// Shown under an infinite list whose last load failed. Scrolling loads nothing
// more until a retry works.
function LoadMoreFailed({ message, onRetry }: LoadMoreFailedProps) {
  return (
    <div role="alert" className="flex justify-center items-center gap-3 py-4">
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
      <Button onClick={onRetry} variant="outlined" size="small" color="inherit">
        Retry
      </Button>
    </div>
  );
}

export default LoadMoreFailed;
