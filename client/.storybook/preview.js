import React from 'react';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { MemoryRouter } from 'react-router-dom';
import WebSocketContext from '../src/contexts/WebSocketContext';
import { lightTheme, darkTheme } from '../src/theme';
import { defaultMswHandlers } from './fixtures/mswHandlers';

initialize({
  onUnhandledRequest: 'bypass',
});

/**
 * Stub WebSocket context for stories. subscribe/unsubscribe are no-ops since
 * stories don't need live socket events. Override via story decorators if needed.
 */
const mockWebSocketContext = {
  socket: null,
  subscribe: () => {},
  unsubscribe: () => {},
};

const normalizeHandlers = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    return Object.values(value).flat().filter(Boolean);
  }
  return [];
};

const mergeMswHandlersLoader = async (context) => {
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
};

const preview = {
  loaders: [mergeMswHandlersLoader, mswLoader],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const selectedTheme = context.globals.theme === 'dark' ? darkTheme : lightTheme;

      return React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          LocalizationProvider,
          { dateAdapter: AdapterDateFns },
          React.createElement(
            ThemeProvider,
            { theme: selectedTheme },
            React.createElement(CssBaseline, null),
            React.createElement(
              WebSocketContext.Provider,
              { value: mockWebSocketContext },
              React.createElement(Story)
            )
          )
        )
      );
    },
  ],
};

export default preview;
