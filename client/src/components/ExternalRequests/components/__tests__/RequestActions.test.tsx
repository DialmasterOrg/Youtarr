import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestActions from '../RequestActions';
import { ExternalRequestReview } from '../../../../types/externalRequest';

const request: ExternalRequestReview = {
  id: 'request-1',
  type: 'video',
  status: 'pending',
  requester: null,
  target: {
    youtubeId: 'abcdefghijk',
    channelId: null,
    youtubeChannelId: null,
    channelTitle: null,
    title: 'Safe video',
    mediaType: 'video',
    rating: null,
  },
  job: null,
  createdAt: '2026-07-26T12:00:00.000Z',
  updatedAt: '2026-07-26T12:00:00.000Z',
};

const renderActions = (overrides: Partial<React.ComponentProps<typeof RequestActions>> = {}) => {
  const props = { request, submitting: false, onDetails: jest.fn(), onAction: jest.fn(), ...overrides };
  render(<RequestActions {...props} />);
  return props;
};

describe('RequestActions', () => {
  test('starts an approval', async () => {
    const { onAction } = renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'Approve request' }));

    expect(onAction).toHaveBeenCalledWith('approve');
  });

  test('starts a rejection', async () => {
    const { onAction } = renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'Reject request' }));

    expect(onAction).toHaveBeenCalledWith('reject');
  });

  test('opens details', async () => {
    const { onDetails } = renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(onDetails).toHaveBeenCalled();
  });

  test('disables approval once a request is approved', () => {
    renderActions({ request: { ...request, status: 'approved' } });

    expect(screen.getByRole('button', { name: 'Approve request' })).toBeDisabled();
  });

  test('disables decisions for a completed request', () => {
    renderActions({ request: { ...request, status: 'completed' } });

    expect(screen.getByRole('button', { name: 'Approve request' })).toBeDisabled();
  });

  test('disables every control while a decision is submitting', () => {
    renderActions({ submitting: true });

    expect(screen.getByRole('button', { name: 'Details' })).toBeDisabled();
  });
});
