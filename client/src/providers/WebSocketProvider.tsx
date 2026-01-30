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

  const connect = useCallback(() => {
    const host = window.location.hostname;
    const port =
      import.meta.env.DEV ? '3011' : window.location.port;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${host}:${port}`);

    ws.onopen = () => {
      setRetries(0); // Reset retries counter when successfully connected
    };

    ws.onclose = () => {
      // If the connection was closed, try to reconnect after a delay.
      const delay = calculateBackoff(retries);
      setTimeout(connect, delay);
    };

    ws.onerror = (error: Event) => {
      setRetries((retries) => retries + 1);
    };

    setSocket(ws);
  }, [retries]);

  // Function to calculate backoff time
  const calculateBackoff = (retries: number) => {
    // This is a simple exponential backoff strategy with a max delay of 30 seconds.
    const delay = Math.min(30 * 1000, Math.pow(2, retries) * 1000);
    return delay;
  };

  const showDownloadCompleteNotification = async (payload: any) => {
    if (!('Notification' in window)) {
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

  const contextValue = React.useMemo(() => ({ socket, subscribe, unsubscribe }), [socket, subscribe, unsubscribe]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
