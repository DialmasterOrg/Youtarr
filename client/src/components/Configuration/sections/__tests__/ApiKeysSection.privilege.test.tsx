import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ApiKeysSection from '../ApiKeysSection';
import { renderWithProviders } from '../../../../test-utils';
import { useApiKeys } from '../ApiKeysSection/useApiKeys';

jest.mock('../ApiKeysSection/useApiKeys', () => {
  const actual = jest.requireActual('../ApiKeysSection/useApiKeys');
  return { ...actual, useApiKeys: jest.fn() };
});

const mockedUseApiKeys = useApiKeys as jest.MockedFunction<typeof useApiKeys>;
const externalKey = {
  id: 7,
  name: 'External Client',
  key_prefix: 'client1234',
  created_at: '2026-07-27T18:30:00.000Z',
  last_used_at: null,
  is_active: true,
  usage_count: 0,
  channel_grant_count: 0,
  role: 'view' as const,
  allow_video_requests: false,
  allow_channel_requests: false,
  allow_delete_video_requests: false,
  auto_approve_video_requests: false,
  auto_approve_channel_requests: false,
  auto_approve_delete_requests: false,
  max_rating_level: 3,
  allow_unrated: false,
  allowed_media_types: ['video' as const],
  max_active_jobs: 5,
  hourly_write_limit: 30,
  daily_write_limit: 200,
  revoked_at: null,
};

const props = (): React.ComponentProps<typeof ApiKeysSection> => ({
  token: 'test-token',
  apiKeyRateLimit: 10,
  onRateLimitChange: jest.fn(),
  showRequestsNavLink: true,
  onShowRequestsNavLinkChange: jest.fn(),
});

describe('ApiKeysSection privilege confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseApiKeys.mockReturnValue({
      fetchApiKeys: jest.fn().mockResolvedValue([externalKey]),
      fetchAvailableChannels: jest.fn().mockResolvedValue([{
        database_id: 12,
        channel_id: 'UC123',
        uploader: 'Safe Channel',
        title: 'Safe Channel',
        terminated_at: null,
      }]),
      fetchChannelGrants: jest.fn().mockResolvedValue([]),
      createApiKey: jest.fn(),
      updateExternalAccess: jest.fn().mockResolvedValue({ success: true }),
      revokeApiKey: jest.fn(),
      regenerateApiKey: jest.fn(),
    });
  });

  async function openEditor() {
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);
    await user.click(await screen.findByRole('button', {
      name: 'Edit External Client external access',
    }));
    await screen.findByLabelText('Request videos');
    return user;
  }

  it('uses the app Dialog and never calls native confirm for an increase', async () => {
    const nativeConfirm = jest.spyOn(window, 'confirm');
    const user = await openEditor();
    await user.click(screen.getByLabelText('Request videos'));
    await user.click(screen.getByRole('button', { name: 'Save External Access' }));

    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm expanded external access?')).toBeInTheDocument();
    nativeConfirm.mockRestore();
  });

  it('cancels an increase without submitting', async () => {
    const user = await openEditor();
    await user.click(screen.getByLabelText('Request videos'));
    await user.click(screen.getByRole('button', { name: 'Save External Access' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockedUseApiKeys.mock.results[0].value.updateExternalAccess).not.toHaveBeenCalled();
  });

  it('confirms an increase with exactly one normalized update', async () => {
    const user = await openEditor();
    await user.click(screen.getByLabelText('Request videos'));
    await user.click(screen.getByRole('button', { name: 'Save External Access' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const update = mockedUseApiKeys.mock.results[0].value.updateExternalAccess;
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({
      policy: expect.objectContaining({ allowVideoRequests: true, maxActiveJobs: 5 }),
      channelIds: [],
    }));
  });

  it('submits a direct non-increase without confirmation', async () => {
    const user = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Save External Access' }));

    const update = mockedUseApiKeys.mock.results[0].value.updateExternalAccess;
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Confirm expanded external access?')).not.toBeInTheDocument();
  });
});
