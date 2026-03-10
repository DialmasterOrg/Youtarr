import type { Preview } from '@storybook/react';
import { initialize, mswLoader } from 'msw-storybook-addon';
import '../src/tailwind.css';
import '../src/index.css';
import WebSocketContext from '../src/contexts/WebSocketContext';
import { ThemeEngineProvider } from '../src/contexts/ThemeEngineContext';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { defaultMswHandlers } from './fixtures/mswHandlers';

initialize({
  onUnhandledRequest: 'bypass',
});

const mockWebSocketContext = {
  socket: null,
  subscribe: () => {},
  unsubscribe: () => {},
};

function normalizeHandlers(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flat().filter(Boolean);
  }
  return [];
}

async function mergeMswHandlersLoader(context: Parameters<NonNullable<Preview['loaders']>[number]>[0]) {
  const existingMsw = context.parameters?.msw;
  const existingHandlers = normalizeHandlers(
    existingMsw && typeof existingMsw === 'object' && 'handlers' in existingMsw
      ? existingMsw.handlers
      : existingMsw
  );

  context.parameters = {
    ...context.parameters,
    msw: {
      ...(typeof existingMsw === 'object' ? existingMsw : {}),
      handlers: [...existingHandlers, ...defaultMswHandlers],
    },
  };

  return {};
}

const preview: Preview = {
  loaders: [mergeMswHandlersLoader, mswLoader],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    layout: 'centered',
  },
  globalTypes: {
    themeMode: {
      name: 'Theme Mode',
      description: 'App theme family',
      defaultValue: 'playful',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'playful', title: 'Playful' },
          { value: 'linear', title: 'Linear' },
          { value: 'flat', title: 'Flat' },
        ],
      },
    },
    colorMode: {
      name: 'Color Mode',
      description: 'Global color mode for stories',
      defaultValue: 'light',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
    motionEnabled: {
      name: 'Motion',
      description: 'Enable playful motion effects',
      defaultValue: 'off',
      toolbar: {
        icon: 'walk',
        items: [
          { value: 'off', title: 'Off' },
          { value: 'on', title: 'On' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('uiThemeMode', context.globals.themeMode === 'linear' || context.globals.themeMode === 'flat' ? context.globals.themeMode : 'playful');
        localStorage.setItem('uiColorMode', context.globals.colorMode === 'dark' ? 'dark' : 'light');
        localStorage.setItem('uiMotionEnabled', context.globals.motionEnabled === 'on' ? 'true' : 'false');
        document.documentElement.setAttribute(
          'data-theme',
          context.globals.colorMode === 'dark' ? 'dark' : 'light'
        );
      }

      return (
        <ThemeEngineProvider key={`${context.globals.themeMode}-${context.globals.colorMode}-${context.globals.motionEnabled}`}>
          <WebSocketContext.Provider value={mockWebSocketContext}>
            <TooltipProvider>
              <Story />
            </TooltipProvider>
          </WebSocketContext.Provider>
        </ThemeEngineProvider>
      );
    },
  ],
};

export default preview;
