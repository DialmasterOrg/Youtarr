import { expect, jest } from '@jest/globals';
import { within, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

export { expect, userEvent, within, waitFor };

export const fn = jest.fn.bind(jest);
