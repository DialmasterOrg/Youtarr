import React, { useState, useEffect, useCallback, ReactNode } from 'react';
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
  const subscribe = useCallback(
    (filter: (message: any) => boolean, callback: (data: any) => void) => {
      console.log('WebSocketProvider.subscribe called!');
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
      process.env.NODE_ENV === 'development' ? '3011' : window.location.port;
    const ws = new WebSocket(`ws://${host}:${port}`);

    ws.onopen = () => {
      console.log('Connected to socket');
      setRetries(0); // Reset retries counter when successfully connected
    };

    ws.onclose = () => {
      console.log('Socket closed connection');
      // If the connection was closed, try to reconnect after a delay.
      const delay = calculateBackoff(retries);
      console.log(`Reconnecting in ${delay}ms...`);
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

  useEffect(() => {
    if (!socket) {
      console.log('WebSocketProvider connecting...');
      connect();
    } else {
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        // Uncomment to debug web socket messages...
        //console.log('Received message from socket: ', message);
        subscriptions.forEach((sub) => {
          if (sub.filter(message)) {
            sub.callback(message.payload);
          }
        });
      };
    }

    return () => {
      console.log('WebSocketProvider unmounting...');
      if (socket) {
        socket.close();
      }
    };
  }, [connect, socket, subscriptions]);

  return (
    <WebSocketContext.Provider value={{ socket, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketProvider;
