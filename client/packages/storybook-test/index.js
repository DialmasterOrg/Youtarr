import { expect, vi } from 'vitest';
import { within, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

export { expect, userEvent, within, waitFor };

export const fn = vi.fn.bind(vi);
