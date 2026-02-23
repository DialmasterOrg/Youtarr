import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WebSocketContext from './contexts/WebSocketContext';
import { ThemeEngineProvider } from './contexts/ThemeEngineContext';
import { TooltipProvider } from './components/ui/tooltip';

type WebSocketValue = {
  socket: any;
  subscribe: jest.Mock;
  unsubscribe: jest.Mock;
} | null;

export function createMockWebSocketContext(): NonNullable<WebSocketValue> {
  return {
    socket: null,
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  opts?: { websocketValue?: WebSocketValue }
) {
  const value = opts?.websocketValue ?? createMockWebSocketContext();

  return render(
    <MemoryRouter>
      <ThemeEngineProvider>
        <WebSocketContext.Provider value={value}>
          <TooltipProvider>
            {ui}
          </TooltipProvider>
        </WebSocketContext.Provider>
      </ThemeEngineProvider>
    </MemoryRouter>
  );
}
