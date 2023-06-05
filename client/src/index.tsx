import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import WebSocketProvider from './providers/WebSocketProvider';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <WebSocketProvider>
      <App />
    </WebSocketProvider>
  </React.StrictMode>
);
