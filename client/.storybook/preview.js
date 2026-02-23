import React from 'react';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import WebSocketContext from '../src/contexts/WebSocketContext';
import { lightTheme, darkTheme } from '../src/theme';
import { defaultMswHandlers } from './fixtures/mswHandlers';

/**
 * STORYBOOK ROUTER CONFIGURATION
 * 
 * Stories for components that use React Router hooks (useNavigate, useParams, useLocation)
 * must explicitly wrap their components with MemoryRouter to avoid runtime errors.
 * 
 * Router-dependent components with stories:
 * - ChannelManager (.../ChannelManager.story.tsx)
 * - ChannelPage (.../ChannelPage.story.tsx)
 * - DownloadManager (.../DownloadManager.story.tsx)
 * - ChannelVideos (.../ChannelPage/__tests__/ChannelVideos.story.tsx)
 * - DownloadProgress (.../DownloadManager/__tests__/DownloadProgress.story.tsx)
 * 
 * To add routing to a story:
 * 
 * 1. For components that need routing context but no specific routes:
 *    import { MemoryRouter } from 'react-router-dom';
 *    const meta: Meta<typeof MyComponent> = {
 *      // ...
 *      decorators: [
 *        (Story) => <MemoryRouter><Story /></MemoryRouter>
 *      ]
 *    };
 * 
 * 2. For components that need specific routes/parameters:
 *    import { MemoryRouter, Routes, Route } from 'react-router-dom';
 *    const meta: Meta<typeof MyComponent> = {
 *      // ...
 *      render: (args) => (
 *        <MemoryRouter initialEntries={['/path/to/route']}>
 *          <Routes>
 *            <Route path="/path/:id" element={<MyComponent {...args} />} />
 *          </Routes>
 *        </MemoryRouter>
 *      )
 *    };
 */

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
      );
    },
  ],
};

export default preview;
