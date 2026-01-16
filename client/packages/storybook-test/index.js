import { fn as jestFn } from 'jest-mock';
import { within, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import storybookExpect from '@storybook/expect';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';

storybookExpect.extend(jestDomMatchers);

export const expect = storybookExpect;
export { userEvent, within, waitFor };

export const fn = jestFn;
