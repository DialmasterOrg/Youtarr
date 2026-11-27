import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LoadMoreFailed from '../LoadMoreFailed';

describe('LoadMoreFailed', () => {
  test('announces the failure and retries on request', async () => {
    const onRetry = jest.fn();
    render(<LoadMoreFailed message="Could not load channels." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load channels.');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
