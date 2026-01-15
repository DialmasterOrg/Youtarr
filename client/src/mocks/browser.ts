import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// This configures a request mocking worker with the given request handlers.
export const worker = setupWorker(...handlers);
