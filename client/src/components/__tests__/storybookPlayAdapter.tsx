import React from 'react';
import { render } from '@testing-library/react';
import WebSocketContext from '../../contexts/WebSocketContext';
import { ThemeEngineProvider } from '../../contexts/ThemeEngineContext';

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

function setViewportMatch(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(max-width: 767px)' ? isMobile : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

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
    globals: {
      ...(meta.globals || {}),
      ...(story.globals || {}),
    },
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
  
  if (typeof window !== 'undefined') {
    const themeMode = context.globals.themeMode || 'playful';
    const colorMode = context.globals.colorMode || context.globals.theme || 'light';
    const motionEnabled = context.globals.motionEnabled === 'on' || context.globals.motionEnabled === true;
    localStorage.setItem('uiThemeMode', themeMode);
    localStorage.setItem('uiColorMode', colorMode === 'dark' ? 'dark' : 'light');
    localStorage.setItem('uiMotionEnabled', String(motionEnabled));
    setViewportMatch(context.parameters.layoutBreakpoint === 'mobile');
  }

  const withProviders = (
    <ThemeEngineProvider>
      <WebSocketContext.Provider value={mockWebSocketContext}>
        {decoratedNode}
      </WebSocketContext.Provider>
    </ThemeEngineProvider>
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