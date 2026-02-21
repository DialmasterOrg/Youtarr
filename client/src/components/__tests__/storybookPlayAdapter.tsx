import React from 'react';
import { render } from '@testing-library/react';

type AnyObject = Record<string, any>;

type StoryModule = {
  default: AnyObject;
  [key: string]: any;
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
    globals: {},
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
  const utils = render(<>{decoratedNode}</>);

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