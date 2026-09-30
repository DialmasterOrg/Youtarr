import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ApiKeysSection from '../ApiKeysSection';
import { renderWithProviders } from '../../../../test-utils';
import { useApiKeys } from '../ApiKeysSection/useApiKeys';
import type { ChannelListEntry } from '../../../Subscriptions/hooks/useChannelList';

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

const safeChannel: ChannelListEntry = {
  database_id: 12,
  url: 'https://www.youtube.com/channel/UC123',
  channel_id: 'UC123',
  uploader: 'Safe Channel',
  title: 'Safe Channel',
  terminated_at: null,
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('ApiKeysSection privilege confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseApiKeys.mockReturnValue({
      fetchApiKeys: jest.fn().mockResolvedValue([externalKey]),
      fetchAvailableChannels: jest.fn().mockResolvedValue([safeChannel]),
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

  it('saves a corrected numeric policy without reloading channel grants', async () => {
    const user = await openEditor();
    const activeJobs = screen.getByRole('spinbutton', { name: 'Active jobs' });
    const save = screen.getByRole('button', { name: 'Save External Access' });
    await waitFor(() => expect(save).toBeEnabled());

    await user.clear(activeJobs);
    await user.click(save);
    expect(screen.getByText('Active jobs must be an integer from 1 to 5.')).toBeInTheDocument();
    expect(save).toBeEnabled();

    await user.type(activeJobs, '3');
    expect(screen.queryByText('Active jobs must be an integer from 1 to 5.')).not.toBeInTheDocument();
    await user.click(save);

    const api = mockedUseApiKeys.mock.results[0].value;
    await waitFor(() => expect(api.updateExternalAccess).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        policy: expect.objectContaining({ maxActiveJobs: 3 }),
        channelIds: [],
      })
    ));
    expect(api.fetchChannelGrants).toHaveBeenCalledTimes(1);
    expect(api.fetchAvailableChannels).toHaveBeenCalledTimes(1);
  });

  it('allows retrying a failed save without reloading channel grants', async () => {
    const user = await openEditor();
    const api = mockedUseApiKeys.mock.results[0].value;
    const update = api.updateExternalAccess as jest.Mock;
    update.mockRejectedValueOnce(new Error('Temporary save failure'));
    const save = screen.getByRole('button', { name: 'Save External Access' });
    await waitFor(() => expect(save).toBeEnabled());

    await user.click(save);
    expect(await screen.findByText('Temporary save failure')).toBeInTheDocument();
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(api.fetchChannelGrants).toHaveBeenCalledTimes(1);
  });

  it('keeps Save disabled until channel grants and channel options finish loading', async () => {
    const grants = deferred<number[]>();
    const channels = deferred<ChannelListEntry[]>();
    const updateExternalAccess = jest.fn();
    mockedUseApiKeys.mockReturnValue({
      fetchApiKeys: jest.fn().mockResolvedValue([externalKey]),
      fetchAvailableChannels: jest.fn().mockReturnValue(channels.promise),
      fetchChannelGrants: jest.fn().mockReturnValue(grants.promise),
      createApiKey: jest.fn(),
      updateExternalAccess,
      revokeApiKey: jest.fn(),
      regenerateApiKey: jest.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);
    await user.click(await screen.findByRole('button', {
      name: 'Edit External Client external access',
    }));

    const save = screen.getByRole('button', { name: 'Save External Access' });
    expect(save).toBeDisabled();
    await user.click(save);
    expect(updateExternalAccess).not.toHaveBeenCalled();

    await act(async () => {
      grants.resolve([12]);
      channels.resolve([safeChannel]);
    });
    await waitFor(() => expect(save).toBeEnabled());
  });

  it('ignores a slow response from a previously opened key', async () => {
    const slowGrants = deferred<number[]>();
    const slowChannels = deferred<ChannelListEntry[]>();
    const secondChannel: ChannelListEntry = {
      database_id: 22,
      url: 'https://www.youtube.com/channel/UCSECOND',
      channel_id: 'UCSECOND',
      uploader: 'Second Channel',
      title: 'Second Channel',
      terminated_at: null,
    };
    const secondKey = { ...externalKey, id: 8, name: 'Second Client' };
    const fetchAvailableChannels = jest.fn()
      .mockReturnValueOnce(slowChannels.promise)
      .mockResolvedValueOnce([secondChannel]);
    const fetchChannelGrants = jest.fn((keyId: number) => (
      keyId === externalKey.id ? slowGrants.promise : Promise.resolve([22])
    ));
    mockedUseApiKeys.mockReturnValue({
      fetchApiKeys: jest.fn().mockResolvedValue([externalKey, secondKey]),
      fetchAvailableChannels,
      fetchChannelGrants,
      createApiKey: jest.fn(),
      updateExternalAccess: jest.fn(),
      revokeApiKey: jest.fn(),
      regenerateApiKey: jest.fn(),
    });

    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);
    await user.click(await screen.findByRole('button', {
      name: 'Edit External Client external access',
    }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', {
      name: 'Edit Second Client external access',
    }));

    expect(await screen.findByText('Edit External Access — Second Client')).toBeInTheDocument();
    const secondChannelCheckbox = await screen.findByLabelText('Second Channel');
    await waitFor(() => expect(secondChannelCheckbox).toBeChecked());

    await act(async () => {
      slowGrants.resolve([12]);
      slowChannels.resolve([safeChannel]);
    });

    expect(screen.getByText('Edit External Access — Second Client')).toBeInTheDocument();
    expect(secondChannelCheckbox).toBeChecked();
    expect(screen.queryByLabelText('Safe Channel')).not.toBeInTheDocument();
  });
});
