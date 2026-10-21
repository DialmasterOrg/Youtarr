import React, { useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import WebSocketContext from '../contexts/WebSocketContext';
import { locationUtils } from '../utils/location';

interface WebSocketProviderProps {
  // Session token the server requires on the handshake; no connection is
  // opened while it is null.
  token: string | null;
  // Called when the connection suggests the session has ended, so the app can
  // check the token: on a session-ended close, and on every
  // FAILED_CONNECTS_BEFORE_SESSION_CHECK-th attempt in a row that never opens,
  // so a check that could not reach the server is retried.
  onSessionCheckNeeded?: () => void;
  children: ReactNode;
}

interface Subscription {
  filter: (message: any) => boolean;
  callback: (data: any) => void;
}

// Envelope shape shared by server broadcasts and locally-dispatched messages;
// payloads stay unknown until a subscriber's filter narrows them.
interface WebSocketMessage {
  destination?: string;
  source?: string;
  type?: string;
  clientId?: string;
  payload?: unknown;
}

const MAX_BACKOFF_MS = 30 * 1000;
const INITIAL_BACKOFF_MS = 1000;
// Browsers cannot set headers on a WebSocket handshake, so the session token
// travels as a second subprotocol. Must match server/modules/webSocketAuth.js.
const WEBSOCKET_PROTOCOL = 'youtarr';
const AUTH_PROTOCOL_PREFIX = 'youtarr.auth.';
// The server closes a socket with this code once its session has expired or
// been revoked. Must match server/modules/webSocketServer.js.
const SESSION_ENDED_CLOSE_CODE = 1008;
// A refused handshake looks like any network failure to the browser, so a run
// of attempts that never open is the only sign the session may be gone.
const FAILED_CONNECTS_BEFORE_SESSION_CHECK = 3;

const buildWebSocketUrl = () => {
  const protocol = locationUtils.getProtocol() === 'https:' ? 'wss' : 'ws';
  const host = locationUtils.getPort()
    ? `${locationUtils.getHostname()}:${locationUtils.getPort()}`
    : locationUtils.getHostname();

  // Use a stable /ws path. In dev, Vite proxies /ws -> backend.
  return `${protocol}://${host}/ws`;
};

const calculateBackoff = (retries: number) => {
  return Math.min(MAX_BACKOFF_MS, Math.pow(2, retries) * INITIAL_BACKOFF_MS);
};

const showDownloadCompleteNotification = async (videos: unknown[]) => {
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notification');
    return;
  }

  const options = {
    body: `Downloads complete: ${videos.length} videos downloaded`,
    icon: '/favicon.ico',
  };

  const displayNotification = () => {
    new Notification('Youtarr', options);
  };

  switch (Notification.permission) {
    case 'granted':
      displayNotification();
      break;
    case 'default':
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        displayNotification();
      }
      break;
  }
};

const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  token,
  onSessionCheckNeeded,
  children,
}) => {
  // Informational only: nothing may drive effects off this state, or a swap
  // mid-reconnect tears down the fresh socket.
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  const subscriptionsRef = useRef<Subscription[]>([]);
  const failedConnectsRef = useRef(0);
  // Read through a ref so a new callback identity never reconnects the socket
  const onSessionCheckNeededRef = useRef(onSessionCheckNeeded);

  useEffect(() => {
    onSessionCheckNeededRef.current = onSessionCheckNeeded;
  }, [onSessionCheckNeeded]);

  const subscribe = useCallback(
    (filter: (message: any) => boolean, callback: (data: any) => void) => {
      subscriptionsRef.current = [...subscriptionsRef.current, { filter, callback }];
    },
    []
  );

  const unsubscribe = useCallback((callback: (data: any) => void) => {
    subscriptionsRef.current = subscriptionsRef.current.filter(
      (sub) => sub.callback !== callback
    );
  }, []);

  const dispatchMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'downloadComplete') {
      const videos = (message.payload as { videos?: unknown })?.videos;
      if (Array.isArray(videos) && videos.length > 0) {
        showDownloadCompleteNotification(videos);
      }
    }

    subscriptionsRef.current.forEach((sub) => {
      if (sub.filter(message)) {
        sub.callback(message.payload);
      }
    });
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || !token) {
      return;
    }
    const existing = socketRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(buildWebSocketUrl(), [
        WEBSOCKET_PROTOCOL,
        `${AUTH_PROTOCOL_PREFIX}${token}`,
      ]);
    } catch (error) {
      // The browser rejects a token that is not a valid subprotocol; retrying
      // the same token cannot succeed, and a new token reconnects.
      console.error('Could not open WebSocket connection:', error);
      return;
    }
    socketRef.current = ws;
    let opened = false;

    ws.onopen = () => {
      opened = true;
      retriesRef.current = 0;
      failedConnectsRef.current = 0;
      if (hasConnectedOnceRef.current) {
        // Synthetic local message: WS replay only carries final states, so
        // data hooks re-probe REST state when the connection comes back.
        dispatchMessage({
          destination: 'local',
          source: 'client',
          type: 'connectionRestored',
          payload: {},
        });
      }
      hasConnectedOnceRef.current = true;
    };

    // Attached at creation so connection-time replay from the server can
    // never race the handler.
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as WebSocketMessage;
      dispatchMessage(message);
    };

    ws.onclose = (event: CloseEvent) => {
      // Ignore closes of superseded sockets and closes during unmount
      if (!mountedRef.current || socketRef.current !== ws) {
        return;
      }
      if (event.code === SESSION_ENDED_CLOSE_CODE) {
        onSessionCheckNeededRef.current?.();
      } else if (!opened) {
        failedConnectsRef.current += 1;
        if (failedConnectsRef.current % FAILED_CONNECTS_BEFORE_SESSION_CHECK === 0) {
          onSessionCheckNeededRef.current?.();
        }
      }
      // Dead socket must not gate the next connect() attempt, and consumers
      // must not see the closed instance as a live connection
      socketRef.current = null;
      setSocket(null);
      const delay = calculateBackoff(retriesRef.current);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (error: Event) => {
      console.log('Socket encountered error: ', error);
      retriesRef.current += 1;
    };

    setSocket(ws);
  }, [dispatchMessage, token]);

  useEffect(() => {
    mountedRef.current = true;
    failedConnectsRef.current = 0;
    connect();

    // Sleep/wake and network blips leave a dead socket with a long pending
    // backoff; both signals mean "try again now".
    const reconnectIfDead = () => {
      const current = socketRef.current;
      const dead =
        !current ||
        current.readyState === WebSocket.CLOSED ||
        current.readyState === WebSocket.CLOSING;
      if (!dead) {
        return;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      retriesRef.current = 0;
      connect();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reconnectIfDead();
      }
    };

    window.addEventListener('online', reconnectIfDead);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', reconnectIfDead);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, [connect]);

  const contextValue = useMemo(
    () => ({ socket, subscribe, unsubscribe }),
    [socket, subscribe, unsubscribe]
  );

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
