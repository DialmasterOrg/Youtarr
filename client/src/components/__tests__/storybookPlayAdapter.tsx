import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { MemoryRouter } from 'react-router-dom';
import WebSocketContext from '../../contexts/WebSocketContext';
import { lightTheme, darkTheme } from '../../theme';

type AnyObject = Record<string, any>;

type StoryModule = {
  default: AnyObject;
  [key: string]: any;
};

/**
 * Mock WebSocket context for stories.
 */
const mockWebSocketContext = {
  socket: null,
  subscribe: () => {},
  unsubscribe: () => {},
};

function applyDecorators(storyNode: React.ReactNode, decorators: any[], context: AnyObject) {
  return decorators.reduceRight((currentNode, decorator) => {
    const Story = () => <>{currentNode}</>;
    return decorator(Story, context);
  }, storyNode);
}

export async function runStoryWithPlay(storyModule: StoryModule, storyName: string) {
  const meta = storyModule.default || {};
  const story = storyModule[storyName] || {};

  const args = {
    ...(meta.args || {}),
    ...(story.args || {}),
  };

  const context = {
    id: storyName,
    title: meta.title,
    name: storyName,
    args,
    parameters: {
      ...(meta.parameters || {}),
      ...(story.parameters || {}),
    },
    globals: { theme: 'light' },
    viewMode: 'story',
    hooks: {},
  };

  const renderFn = story.render || meta.render || ((renderArgs: AnyObject) => {
    const Component = meta.component;
    return <Component {...renderArgs} />;
  });

  const decorators = [...(meta.decorators || []), ...(story.decorators || [])];
  const StoryRenderComponent = () => renderFn(args, context);
  const initialNode = <StoryRenderComponent />;
  const decoratedNode = applyDecorators(initialNode, decorators, context);
  
  // Apply global providers (mimicking preview.js setup)
  const selectedTheme = context.globals.theme === 'dark' ? darkTheme : lightTheme;
  
  const withProviders = (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <ThemeProvider theme={selectedTheme}>
        <CssBaseline />
        <WebSocketContext.Provider value={mockWebSocketContext}>
          {decoratedNode}
        </WebSocketContext.Provider>
      </ThemeProvider>
    </LocalizationProvider>
  );
  
  const utils = render(<>{withProviders}</>);

  if (typeof story.play === 'function') {
    await story.play({
      canvasElement: utils.container,
      args,
      step: async (_label: string, playStep: () => Promise<void> | void) => {
        await playStep();
      },
      context,
      loaded: {},
      globals: {},
      parameters: context.parameters,
      viewMode: 'story',
      canvas: undefined,
      mount: undefined,
      userEvent: undefined,
      within: undefined,
      expect: undefined,
    } as any);
  }

  return {
    args,
    renderResult: utils,
  };
}