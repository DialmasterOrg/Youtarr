declare module '@storybook/react' {
  export type Meta<T = any> = Record<string, any>;
  export type StoryObj<T = any> = Record<string, any>;
}

declare module 'storybook/test' {
  export const expect: any;
  export const fn: (...args: any[]) => any;
  export const userEvent: any;
  export const within: any;
}