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

type SocketSubscription = [filter: (message: unknown) => boolean, callback: (payload: unknown) => void];

// Subscriptions still active on each mock context, so a delivered message
// never reaches a callback that was unsubscribed.
const activeSubscriptions = new WeakMap<object, SocketSubscription[]>();

export function createMockWebSocketContext(): NonNullable<WebSocketValue> {
  const context = {
    socket: null,
    subscribe: jest.fn((...subscription: SocketSubscription) => {
      activeSubscriptions.get(context)?.push(subscription);
    }),
    unsubscribe: jest.fn((callback: SocketSubscription[1]) => {
      const active = activeSubscriptions.get(context) ?? [];
      activeSubscriptions.set(context, active.filter(([, subscribed]) => subscribed !== callback));
    }),
  };
  activeSubscriptions.set(context, []);
  return context;
}

/** Delivers a message to a mock context's subscribers the way WebSocketProvider does. */
export function deliverSocketMessage(
  context: NonNullable<WebSocketValue>,
  message: { type: string; destination?: string; source?: string; payload?: unknown }
) {
  (activeSubscriptions.get(context) ?? []).forEach(([filter, callback]) => {
    if (filter(message)) callback(message.payload);
  });
}

export function renderWithProviders(
  ui: React.ReactElement,
  opts?: { websocketValue?: WebSocketValue; initialEntries?: string[] }
) {
  const value = opts?.websocketValue ?? createMockWebSocketContext();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={opts?.initialEntries}>
        <ThemeEngineProvider>
          <WebSocketContext.Provider value={value}>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </WebSocketContext.Provider>
        </ThemeEngineProvider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
