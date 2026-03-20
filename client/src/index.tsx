import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-800.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/archivo/latin-500.css';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-700.css';
import '@fontsource/archivo/latin-800.css';
import './tailwind.css';
import './index.css';
import './themeTokens.css';
import App from './App';
import { ThemeEngineProvider } from './contexts/ThemeEngineContext';
import WebSocketProvider from './providers/WebSocketProvider';
import { TooltipProvider } from './components/ui/tooltip';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ThemeEngineProvider>
      <WebSocketProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </WebSocketProvider>
    </ThemeEngineProvider>
  </React.StrictMode>
);
