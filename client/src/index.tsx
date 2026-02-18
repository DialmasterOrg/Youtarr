import React from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind.css';
import './index.css';
import './themeTokens.css';
import App from './App';
import { ThemeEngineProvider } from './contexts/ThemeEngineContext';
import WebSocketProvider from './providers/WebSocketProvider';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ThemeEngineProvider>
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </ThemeEngineProvider>
  </React.StrictMode>
);
