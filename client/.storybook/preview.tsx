import React from 'react';
import type { Preview } from '@storybook/react';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import WebSocketContext from '../src/contexts/WebSocketContext';
import { lightTheme, darkTheme } from '../src/theme';

initialize({
  onUnhandledRequest: 'bypass',
});

const mockWebSocketContext = {
  socket: null,
  subscribe: () => {},
  unsubscribe: () => {},
};

const preview: Preview = {
  loaders: [mswLoader],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
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

      return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <ThemeProvider theme={selectedTheme}>
            <CssBaseline />
            <WebSocketContext.Provider value={mockWebSocketContext}>
              <Story />
            </WebSocketContext.Provider>
          </ThemeProvider>
        </LocalizationProvider>
      );
    },
  ],
};

export default preview;
