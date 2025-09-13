import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import WebSocketContext from './contexts/WebSocketContext';

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
    <BrowserRouter>
      <WebSocketContext.Provider value={value}>
        {ui}
      </WebSocketContext.Provider>
    </BrowserRouter>
  );
}

