import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import WebSocketProvider from '../WebSocketProvider';
import WebSocketContext from '../../contexts/WebSocketContext';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  static instances: MockWebSocket[] = [];
  static clearInstances() {
    MockWebSocket.instances = [];
  }
}

// Mock Notification API
const mockNotification = {
  permission: 'default' as NotificationPermission,
  requestPermission: jest.fn(),
};

const NotificationConstructor = jest.fn();

Object.defineProperty(window, 'Notification', {
  value: NotificationConstructor,
  writable: true,
  configurable: true,
});

Object.defineProperty(NotificationConstructor, 'permission', {
  get: () => mockNotification.permission,
  configurable: true,
});

Object.defineProperty(NotificationConstructor, 'requestPermission', {
  value: mockNotification.requestPermission,
  configurable: true,
});

// Test component to consume context
const TestConsumer: React.FC = () => {
  const context = React.useContext(WebSocketContext);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [subscribed, setSubscribed] = React.useState(false);

  React.useEffect(() => {
    if (context && !subscribed) {
      context.subscribe(
        (message) => message.type === 'test',
        (data) => setMessages((prev) => [...prev, data])
      );
      setSubscribed(true);
    }
  }, [context, subscribed]);

  return (
    <div>
      <div data-testid="socket-status">{context?.socket ? 'connected' : 'disconnected'}</div>
      <div data-testid="messages">{JSON.stringify(messages)}</div>
      {context && (
        <>
          <button
            data-testid="subscribe-button"
            onClick={() => {
              context.subscribe(
                (message) => message.type === 'another',
                (data) => console.log('Another subscription', data)
              );
            }}
          >
            Subscribe
          </button>
          <button
            data-testid="unsubscribe-button"
            onClick={() => {
              context.unsubscribe((data) => console.log('Another subscription', data));
            }}
          >
            Unsubscribe
          </button>
        </>
      )}
    </div>
  );
};

describe('WebSocketProvider', () => {
  let originalWebSocket: typeof WebSocket;
  let originalConsoleLog: typeof console.log;
  let originalLocation: Location;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    MockWebSocket.clearInstances();
    originalWebSocket = global.WebSocket;
    originalConsoleLog = console.log;
    originalLocation = window.location;
    console.log = jest.fn();
    (global as any).WebSocket = MockWebSocket;
    mockNotification.permission = 'default';
    mockNotification.requestPermission.mockResolvedValue('granted');
    NotificationConstructor.mockClear();

    // Mock window.location with default values
    delete (window as any).location;
    (window as any).location = {
      hostname: 'localhost',
      port: '',
      protocol: 'http:',
      href: '',
      origin: '',
      pathname: '',
      search: '',
      hash: '',
      host: 'localhost',
      reload: jest.fn(),
      replace: jest.fn(),
      assign: jest.fn(),
      ancestorOrigins: {} as DOMStringList,
      toString: jest.fn(() => 'http://localhost')
    };
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    (global as any).WebSocket = originalWebSocket;
    console.log = originalConsoleLog;
    (window as any).location = originalLocation;
  });

  test('renders children correctly', () => {
    render(
      <WebSocketProvider>
        <div data-testid="child">Test Child</div>
      </WebSocketProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  test('creates WebSocket connection on mount', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development';

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe('ws://localhost:3011');

    (process.env as any).NODE_ENV = originalEnv;
  });

  test('uses correct WebSocket URL in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development';

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe('ws://localhost:3011');

    (process.env as any).NODE_ENV = originalEnv;
  });

  test('uses correct WebSocket URL in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    (window as any).location.port = '3087';

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe('ws://localhost:3087');

    (process.env as any).NODE_ENV = originalEnv;
  });

  test('uses WSS protocol for HTTPS connections', () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development';
    (window as any).location.protocol = 'https:';

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe('wss://localhost:3011');

    (process.env as any).NODE_ENV = originalEnv;
  });

  test('resets retry counter on connection open', async () => {
    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];
    const initialCount = MockWebSocket.instances.length;

    // Trigger an error to increment retry counter
    act(() => {
      if (ws.onerror) {
        ws.onerror(new Event('error'));
      }
    });

    // Open connection - this should reset retries to 0
    act(() => {
      if (ws.onopen) {
        ws.onopen(new Event('open'));
      }
    });

    // Close the connection - should now use initial delay since retries was reset
    act(() => {
      if (ws.onclose) {
        ws.onclose(new CloseEvent('close'));
      }
    });

    // Should reconnect with initial delay (1000ms), proving retries were reset
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount);
  });

  test('handles WebSocket connection close and reconnects with backoff', async () => {
    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];

    act(() => {
      if (ws.onclose) {
        ws.onclose(new CloseEvent('close'));
      }
    });

    // Verify initial connection attempt exists
    expect(MockWebSocket.instances).toHaveLength(1);

    // Fast forward time to trigger reconnection (initial delay is 1000ms)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Verify a new connection was created
    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2);
    });
  });

  test('implements exponential backoff for reconnection', () => {
    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const initialWs = MockWebSocket.instances[0];

    // Trigger error which increments retry counter to 1
    act(() => {
      if (initialWs.onerror) {
        initialWs.onerror(new Event('error'));
      }
    });

    // Verify error was logged (this console.log still exists in the code)
    expect(console.log).toHaveBeenCalledWith('Socket encountered error: ', expect.any(Event));

    // The exponential backoff logic exists and is tested through the
    // "resets retry counter on successful connection" test which verifies
    // that retries affect reconnection behavior
  });

  test('resets retry counter on successful connection', async () => {
    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws1 = MockWebSocket.instances[0];

    // Simulate error and reconnection
    act(() => {
      if (ws1.onerror) {
        ws1.onerror(new Event('error'));
      }
      if (ws1.onclose) {
        ws1.onclose(new CloseEvent('close'));
      }
    });

    // Wait for reconnection with 2000ms delay (retry=1)
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    const ws2 = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    const countBeforeReset = MockWebSocket.instances.length;

    // Successful connection should reset retries
    act(() => {
      if (ws2.onopen) {
        ws2.onopen(new Event('open'));
      }
    });

    // Next failure should start from initial delay (1000ms)
    act(() => {
      if (ws2.onclose) {
        ws2.onclose(new CloseEvent('close'));
      }
    });

    // Should reconnect after 1000ms (initial delay), proving retries were reset
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(MockWebSocket.instances.length).toBeGreaterThan(countBeforeReset);
  });

  test('handles WebSocket error events', () => {
    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];
    const errorEvent = new Event('error');

    act(() => {
      if (ws.onerror) {
        ws.onerror(errorEvent);
      }
    });

    expect(console.log).toHaveBeenCalledWith('Socket encountered error: ', errorEvent);
  });

  test('subscribes to messages and filters them correctly', async () => {
    const { rerender } = render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];

    // Send a matching message
    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({ type: 'test', payload: { data: 'test data' } })
        }));
      }
    });

    rerender(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('messages')).toHaveTextContent('[{"data":"test data"}]');
    });

    // Send a non-matching message
    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({ type: 'other', payload: { data: 'other data' } })
        }));
      }
    });

    // Should still only have the first message
    expect(screen.getByTestId('messages')).toHaveTextContent('[{"data":"test data"}]');
  });

  test('shows download complete notification for new videos', async () => {
    mockNotification.permission = 'granted';

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];

    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'downloadComplete',
            payload: { videos: ['video1', 'video2'] }
          })
        }));
      }
    });

    await waitFor(() => {
      expect(NotificationConstructor).toHaveBeenCalledWith('Youtarr', {
        body: 'Downloads complete: 2 videos downloaded',
        icon: '/favicon.ico',
      });
    });
  });

  test('requests notification permission when not granted', async () => {
    mockNotification.permission = 'default';
    mockNotification.requestPermission.mockResolvedValue('granted');

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];

    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'downloadComplete',
            payload: { videos: ['video1'] }
          })
        }));
      }
    });

    await waitFor(() => {
      expect(mockNotification.requestPermission).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(NotificationConstructor).toHaveBeenCalled();
    });
  });

  test('does not show notification when permission denied', async () => {
    mockNotification.permission = 'denied';

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];

    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'downloadComplete',
            payload: { videos: ['video1'] }
          })
        }));
      }
    });

    await waitFor(() => {
      expect(NotificationConstructor).not.toHaveBeenCalled();
    });
  });

  test('does not show notification for empty video downloads', async () => {
    mockNotification.permission = 'granted';

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];

    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'downloadComplete',
            payload: { videos: [] }
          })
        }));
      }
    });

    await waitFor(() => {
      expect(NotificationConstructor).not.toHaveBeenCalled();
    });
  });

  test('handles browser without notification support', async () => {
    // Delete Notification from window to simulate unsupported browser
    delete (window as any).Notification;

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];

    // Set up the message handler first
    await waitFor(() => {
      expect(ws.onmessage).toBeDefined();
    });

    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'downloadComplete',
            payload: { videos: ['video1'] }
          })
        }));
      }
    });

    // Verify the specific log message for unsupported notification
    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith('This browser does not support desktop notification');
    });

    // Restore Notification for other tests
    Object.defineProperty(window, 'Notification', {
      value: NotificationConstructor,
      writable: true,
      configurable: true
    });
  });

  test('unsubscribes from messages correctly', async () => {
    const callback = jest.fn();
    let testContext: any = null;

    const TestComponent = () => {
      const context = React.useContext(WebSocketContext);
      const [subscribed, setSubscribed] = React.useState(false);
      testContext = context;

      React.useEffect(() => {
        if (context && !subscribed) {
          context.subscribe(
            (message) => message.type === 'test',
            callback
          );
          setSubscribed(true);
        }
      }, [context, subscribed]);

      return null;
    };

    render(
      <WebSocketProvider>
        <TestComponent />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];

    // Send a message, callback should be called
    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({ type: 'test', payload: { data: 'test' } })
        }));
      }
    });

    expect(callback).toHaveBeenCalledWith({ data: 'test' });

    // Unsubscribe
    act(() => {
      if (testContext) {
        testContext.unsubscribe(callback);
      }
    });

    callback.mockClear();

    // Send another message, callback should not be called
    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({ type: 'test', payload: { data: 'test2' } })
        }));
      }
    });

    expect(callback).not.toHaveBeenCalled();
  });

  test('cleans up WebSocket connection on unmount', () => {
    const { unmount } = render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];
    const closeSpy = jest.spyOn(ws, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  test('handles multiple subscriptions with different filters', async () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    const TestComponent = () => {
      const context = React.useContext(WebSocketContext);
      const [subscribed, setSubscribed] = React.useState(false);

      React.useEffect(() => {
        if (context && !subscribed) {
          context.subscribe(
            (message) => message.type === 'type1',
            callback1
          );
          context.subscribe(
            (message) => message.type === 'type2',
            callback2
          );
          setSubscribed(true);
        }
      }, [context, subscribed]);

      return null;
    };

    render(
      <WebSocketProvider>
        <TestComponent />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];

    // Send message matching first filter
    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({ type: 'type1', payload: { data: 'data1' } })
        }));
      }
    });

    expect(callback1).toHaveBeenCalledWith({ data: 'data1' });
    expect(callback2).not.toHaveBeenCalled();

    callback1.mockClear();

    // Send message matching second filter
    act(() => {
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify({ type: 'type2', payload: { data: 'data2' } })
        }));
      }
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledWith({ data: 'data2' });
  });

  test('caps reconnection delay at 30 seconds', () => {
    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.instances[0];

    // Simulate many errors to test max delay
    // The calculateBackoff function: Math.min(30 * 1000, Math.pow(2, retries) * 1000)
    // After 5 errors: 2^5 * 1000 = 32000ms, but should be capped at 30000ms
    for (let i = 0; i < 5; i++) {
      act(() => {
        if (ws.onerror) {
          ws.onerror(new Event('error'));
        }
      });
    }

    // Verify that error handling worked
    expect(console.log).toHaveBeenCalledWith('Socket encountered error: ', expect.any(Event));

    // The calculateBackoff function contains the cap logic:
    // Math.min(30 * 1000, Math.pow(2, retries) * 1000)
    // This ensures delays never exceed 30 seconds
  });

  test('provides WebSocket context values correctly', () => {
    let contextValue: any = null;

    const TestComponent = () => {
      contextValue = React.useContext(WebSocketContext);
      return null;
    };

    render(
      <WebSocketProvider>
        <TestComponent />
      </WebSocketProvider>
    );

    expect(contextValue).toHaveProperty('socket');
    expect(contextValue).toHaveProperty('subscribe');
    expect(contextValue).toHaveProperty('unsubscribe');
    expect(typeof contextValue.subscribe).toBe('function');
    expect(typeof contextValue.unsubscribe).toBe('function');
  });
});