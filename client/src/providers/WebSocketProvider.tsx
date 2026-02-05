import React, { useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import WebSocketContext from '../contexts/WebSocketContext';
import { locationUtils } from 'src/utils/location';

interface WebSocketProviderProps {
  children: ReactNode;
}

interface Subscription {
  filter: (message: any) => boolean;
  callback: (data: any) => void;
}

const buildWebSocketUrl = () => {
  const protocol = locationUtils.getProtocol() === 'https:' ? 'wss' : 'ws';
  const host = locationUtils.getPort()
    ? `${locationUtils.getHostname()}:${locationUtils.getPort()}`
    : locationUtils.getHostname();

  // Use a stable /ws path. In dev, Vite proxies /ws -> backend.
  return `${protocol}://${host}/ws`;
};

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
    const ws = new WebSocket(buildWebSocketUrl());

    ws.onopen = () => {
      setRetries(0); // Reset retries counter when successfully connected
    };

    ws.onclose = () => {
      // If the connection was closed, try to reconnect after a delay.
      const delay = calculateBackoff(retries);
      setTimeout(connect, delay);
    };

    ws.onerror = (error: Event) => {
      console.log('Socket encountered error: ', error);
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
