import React, { useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import WebSocketContext from '../contexts/WebSocketContext';

interface WebSocketProviderProps {
  children: ReactNode;
}

interface Subscription {
  filter: (message: any) => boolean;
  callback: (data: any) => void;
}

const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [retries, setRetries] = useState(0);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const subscriptionsRef = useRef<Subscription[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    subscriptionsRef.current = subscriptions;
  }, [subscriptions]);

  const subscribe = useCallback(
    (filter: (message: any) => boolean, callback: (data: any) => void) => {
      setSubscriptions((prev) => [...prev, { filter, callback }]);
    },
    []
  );

  const unsubscribe = useCallback((callback: (data: any) => void) => {
    setSubscriptions((prev) => prev.filter((sub) => sub.callback !== callback));
  }, []);

  const buildWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host; // This includes hostname and port

    // In development and production, we use the proxy/ingress /ws path.
    // The Vite proxy in dev will forward this to the backend root.
    return `${protocol}://${host}/ws`;
  };

  const connect = useCallback(() => {
    const ws = new WebSocket(buildWebSocketUrl());

    ws.onopen = () => {
      setRetries(0); // Reset retries counter when successfully connected
    };

    ws.onclose = () => {
      // Connection closed - clear socket reference.
      setSocket(null);
    };

    ws.onerror = (error: Event) => {
      console.log('Socket encountered error: ', error);
      setRetries((retries) => retries + 1);
    };

    setSocket(ws);
  }, []);

  // Note: reconnect/backoff logic removed — we no longer auto-reconnect from the
  // provider. Keep `retries` state for diagnostics only.

  const showDownloadCompleteNotification = async (payload: any) => {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return;
    }

    const options = {
      body: `Downloads complete: ${payload.videos.length} videos downloaded`,
      icon: '/favicon.ico',
    };

    // Function to display notification
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

  useEffect(() => {
    if (!socket) {
      connect();
    } else {
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);

        // If new videos downloaded, trigger a notification to the user
        if (
          message.type === 'downloadComplete' &&
          message.payload.videos.length > 0
        ) {
          showDownloadCompleteNotification(message.payload);
        }

        // Uncomment to debug web socket messages...
        //console.log('Received message from socket: ', message);
        subscriptionsRef.current.forEach((sub) => {
          if (sub.filter(message)) {
            sub.callback(message.payload);
          }
        });
      };
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connect, socket]);

  return (
    <WebSocketContext.Provider value={{ socket, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
