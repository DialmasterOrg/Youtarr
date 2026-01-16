import type matchers from '@testing-library/jest-dom/matchers';

export const expect: typeof import('@storybook/expect').default & matchers.TestingLibraryMatchers<any, any>;
export const fn: typeof import('jest-mock').fn;
export { within, waitFor } from '@testing-library/dom';
export { default as userEvent } from '@testing-library/user-event';
