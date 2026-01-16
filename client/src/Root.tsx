import React from 'react';
import App from './App';
import { ThemeEngineProvider } from './contexts/ThemeEngineContext';
import WebSocketProvider from './providers/WebSocketProvider';

export function Root() {
  return (
    <React.StrictMode>
      <ThemeEngineProvider>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </ThemeEngineProvider>
    </React.StrictMode>
  );
}
