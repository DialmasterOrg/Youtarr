declare module '@storybook/react' {
  import type { ReactElement } from 'react';

  export type Meta<T = any> = any;
  export type StoryFn<T = any> = (args: any) => ReactElement | null;
  export type StoryObj<T = any> = {
    render?: StoryFn<T> | ((args: any) => ReactElement | null);
    play?: (context: { canvasElement: HTMLElement; args: any }) => Promise<void> | void;
    [key: string]: any;
  } & Record<string, any>;
}

declare global {
  interface StorybookPlayContext {
    canvasElement: HTMLElement;
    args: any;
  }
}

export {};
