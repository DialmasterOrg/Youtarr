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

// Enhanced render function with proper theme
export const customRender = (
  ui: React.ReactElement,
  options?: { websocketValue?: WebSocketValue }
) => {
  const value = options?.websocketValue ?? createMockWebSocketContext();

  return render(
    <MemoryRouter>
      <ThemeProvider theme={lightTheme}>
        <WebSocketContext.Provider value={value}>
          {ui}
        </WebSocketContext.Provider>
      </ThemeProvider>
    </MemoryRouter>
  );
};

// Test data factories
export const createMockChannel = (overrides = {}) => ({
  id: 1,
  name: 'Test Channel',
  url: 'https://youtube.com/channel/test',
  enabled: true,
  video_quality: '1080p',
  sub_folder: null,
  last_fetched: new Date().toISOString(),
  ...overrides,
});

export const createMockVideo = (overrides = {}) => ({
  id: 1,
  youtube_id: 'test123',
  title: 'Test Video',
  channel_id: 1,
  duration: 3600,
  file_path: '/app/data/test.mp4',
  thumbnail: '/images/video-thumb.jpg',
  published_at: new Date().toISOString(),
  downloaded_at: new Date().toISOString(),
  ...overrides,
});

export const createMockJob = (overrides = {}) => ({
  id: 'job-123',
  type: 'download',
  status: 'running',
  progress: 50,
  created_at: new Date().toISOString(),
  ...overrides,
});

// Common test utilities
export const waitForLoadingToFinish = async () => {
  // Wait for any loading states to resolve
  await new Promise(resolve => setTimeout(resolve, 0));
};

export const mockLocalStorage = () => {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
  return localStorageMock;
};

export const mockAuthToken = (token = 'test-token') => {
  const localStorage = mockLocalStorage();
  localStorage.getItem.mockReturnValue(token);
  return localStorage;
};
