import React from 'react';
import App from './App';
import WebSocketProvider from './providers/WebSocketProvider';

export function Root() {
  return (
    <React.StrictMode>
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </React.StrictMode>
  );
}
