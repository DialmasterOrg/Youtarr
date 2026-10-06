import { useCallback, useState } from 'react';
import { ReorganizeChange } from '../../../../types/reorganize';

interface ReorganizeRequest {
  change: ReorganizeChange | null;
  operationId: number | null;
}

export interface UseReorganizeRequestResult {
  open: boolean;
  change: ReorganizeChange | null;
  operationId: number | null;
  /** Open the dialog on the preview of a change */
  review: (change: ReorganizeChange) => void;
  /** Open the dialog on an operation's progress or result */
  showOperation: (operationId: number) => void;
  close: () => void;
}

/** Which reorganize the dialog shows, for the components that open it. */
export function useReorganizeRequest(): UseReorganizeRequestResult {
  const [request, setRequest] = useState<ReorganizeRequest | null>(null);
  const review = useCallback((change: ReorganizeChange) => setRequest({ change, operationId: null }), []);
  const showOperation = useCallback((operationId: number) => setRequest({ change: null, operationId }), []);
  const close = useCallback(() => setRequest(null), []);
  return {
    open: request !== null,
    change: request?.change ?? null,
    operationId: request?.operationId ?? null,
    review,
    showOperation,
    close,
  };
}

export default useReorganizeRequest;
