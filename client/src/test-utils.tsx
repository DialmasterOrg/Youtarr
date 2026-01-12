import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import WebSocketContext from './contexts/WebSocketContext';

type WebSocketValue = {
  socket: any;
  subscribe: any;
  unsubscribe: any;
} | null;

export function createMockWebSocketContext(): NonNullable<WebSocketValue> {
  return {
    socket: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  opts?: { websocketValue?: WebSocketValue }
) {
  const value = opts?.websocketValue ?? createMockWebSocketContext();
  const theme = createTheme({
    transitions: {
      duration: {
        shortest: 0,
        shorter: 0,
        short: 0,
        standard: 0,
        complex: 0,
        enteringScreen: 0,
        leavingScreen: 0,
      },
    },
  });

  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <WebSocketContext.Provider value={value}>
          {ui}
        </WebSocketContext.Provider>
      </ThemeProvider>
    </MemoryRouter>
  );
}
