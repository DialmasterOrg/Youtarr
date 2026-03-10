declare module '@storybook/react' {
  type PropsOf<T> = T extends import('react').ComponentType<infer P>
    ? P
    : Record<string, unknown>;

  type StoryContext<T> = {
    canvasElement: HTMLElement;
    args: PropsOf<T>;
    [key: string]: unknown;
  };

  export type Meta<T = any> = {
    title?: string;
    component?: T;
    args?: Partial<PropsOf<T>>;
    render?: (args: PropsOf<T>) => import('react').ReactNode;
    decorators?: Array<
      (Story: import('react').ComponentType) => import('react').ReactNode
    >;
    parameters?: Record<string, unknown>;
    [key: string]: unknown;
  };

  export type StoryObj<T = any> = {
    args?: Partial<PropsOf<T>>;
    render?: (args: PropsOf<T>) => import('react').ReactNode;
    decorators?: Array<
      (Story: import('react').ComponentType) => import('react').ReactNode
    >;
    play?: (context: StoryContext<T>) => Promise<void> | void;
    parameters?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

declare module '@storybook/test' {
  export const expect: any;
  export const fn: (...args: any[]) => any;
  export const userEvent: any;
  export const within: any;
  export const waitFor: any;
}

declare module 'storybook/test' {
  export const expect: any;
  export const fn: (...args: any[]) => any;
  export const userEvent: any;
  export const within: any;
  export const waitFor: any;
}