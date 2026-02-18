import React from 'react';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { http, HttpResponse } from 'msw';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { MemoryRouter } from 'react-router-dom';
import WebSocketContext from '../src/contexts/WebSocketContext';
import { lightTheme, darkTheme } from '../src/theme';
import { DEFAULT_CONFIG } from '../src/config/configSchema';

initialize({
  onUnhandledRequest: 'bypass',
});

const mockWebSocketContext = {
  socket: null,
  subscribe: () => {},
  unsubscribe: () => {},
};

const defaultMswHandlers = [
  http.get('/getconfig', () =>
    HttpResponse.json({
      ...DEFAULT_CONFIG,
      preferredResolution: '1080',
      channelFilesToDownload: 3,
      youtubeOutputDirectory: '/downloads/youtube',
      isPlatformManaged: {
        plexUrl: false,
        authEnabled: true,
        useTmpForDownloads: false,
      },
      deploymentEnvironment: {
        platform: null,
        isWsl: false,
      },
    })
  ),
  http.get('/storage-status', () =>
    HttpResponse.json({
      availableGB: '100',
      percentFree: 50,
      totalGB: '200',
    })
  ),
  http.get('/api/channels/subfolders', () => HttpResponse.json(['Movies', 'Shows'])),
  http.get('/api/cookies/status', () =>
    HttpResponse.json({
      cookiesEnabled: false,
      customCookiesUploaded: false,
      customFileExists: false,
    })
  ),
  http.get('/api/keys', () => HttpResponse.json({ keys: [] })),
  http.get('/api/db-status', () => HttpResponse.json({ status: 'healthy' })),
  http.get('/setup/status', () =>
    HttpResponse.json({
      requiresSetup: false,
      isLocalhost: true,
      platformManaged: false,
    })
  ),
  http.get('/getCurrentReleaseVersion', () =>
    HttpResponse.json({
      version: '1.0.0',
      ytDlpVersion: '2024.01.01',
    })
  ),
  http.get('/get-running-jobs', () => HttpResponse.json([])),
  http.get('/runningjobs', () => HttpResponse.json([])),
];

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