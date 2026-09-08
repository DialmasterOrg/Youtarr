import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ApiKeysSection from '../ApiKeysSection';
import { renderWithProviders } from '../../../../test-utils';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const props = (): React.ComponentProps<typeof ApiKeysSection> => ({
  token: 'test-token-123',
  apiKeyRateLimit: 10,
  onRateLimitChange: jest.fn(),
  showRequestsNavLink: true,
  onShowRequestsNavLinkChange: jest.fn(),
});

const externalKey = {
  id: 7,
  name: 'External Client',
  key_prefix: 'client1234',
  created_at: '2026-07-27T18:30:00.000Z',
  last_used_at: '2026-07-27T19:00:00.000Z',
  is_active: true,
  usage_count: 12,
  channel_grant_count: 1,
  role: 'delete',
  allow_video_requests: true,
  allow_channel_requests: true,
  allow_delete_video_requests: true,
  auto_approve_video_requests: false,
  auto_approve_channel_requests: true,
  auto_approve_delete_requests: false,
  max_rating_level: 3,
  allow_unrated: false,
  allowed_media_types: ['video', 'short'],
  revoked_at: null as string | null,
};

const legacyKey = {
  ...externalKey,
  id: 2,
  name: 'My Bookmarklet',
  key_prefix: 'abc12345',
  role: 'legacy_download',
  allow_video_requests: false,
  allow_channel_requests: false,
  allow_delete_video_requests: false,
  auto_approve_channel_requests: false,
  usage_count: 42,
};

const createdKey = {
  success: true,
  message: 'API key created. Save this key - it will not be shown again!',
  id: 8,
  name: 'New Key',
  key: 'abc12345def67890abc12345def67890abc12345def67890abc12345def67890',
  prefix: 'abc12345',
};

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  json: jest.fn().mockResolvedValue(body),
});

const installDefaultFetch = (
  keys: Array<Record<string, unknown>> = [externalKey, legacyKey]
) => {
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/keys' && (!init?.method || init.method === 'GET')) {
      return jsonResponse({ keys });
    }
    if (url === '/getchannels?page=1&pageSize=100&sortOrder=asc') {
      return jsonResponse({
        channels: [{
          database_id: 12,
          channel_id: 'UC1234567890123456789012',
          uploader: 'Safe Channel',
          title: 'Safe Channel',
          terminated_at: null,
        }],
        totalPages: 1,
      });
    }
    if (url === '/api/keys/7/channels') {
      return jsonResponse({ keyId: 7, channelIds: [] });
    }
    if (url === '/api/keys/7/external-access') {
      return jsonResponse({ success: true, key: externalKey, channelIds: [12] });
    }
    if (url === '/api/keys/7/regenerate' && init?.method === 'POST') {
      return jsonResponse({
        ...createdKey,
        message: 'API key regenerated. Save this key - it will not be shown again!',
        id: 7,
        name: 'External Client',
      });
    }
    if (url === '/api/keys' && init?.method === 'POST') {
      return jsonResponse(createdKey);
    }
    if (url.startsWith('/api/keys/') && init?.method === 'DELETE') {
      return jsonResponse({ success: true });
    }
    return jsonResponse({});
  });
};

describe('ApiKeysSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installDefaultFetch();
  });

  test('toggles the Requests navigation link setting', async () => {
    const user = userEvent.setup();
    const onShowRequestsNavLinkChange = jest.fn();
    renderWithProviders(
      <ApiKeysSection
        {...props()}
        onShowRequestsNavLinkChange={onShowRequestsNavLinkChange}
      />
    );

    const toggle = await screen.findByTestId('requests-nav-link-switch');
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(onShowRequestsNavLinkChange).toHaveBeenCalledWith(false);
  });

  test('renders the external section before the legacy section', async () => {
    renderWithProviders(<ApiKeysSection {...props()} />);

    expect(await screen.findByText('External access keys')).toBeInTheDocument();
    const externalHeading = screen.getByText('External access keys');
    const legacyHeading = screen.getByText('Legacy download keys');
    expect(externalHeading.compareDocumentPosition(legacyHeading) &
      Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('/external-api/v1')).toBeInTheDocument();
  });

  test('uses compact cards with rating and permission chips but no key prefix', async () => {
    renderWithProviders(<ApiKeysSection {...props()} />);

    const cards = await screen.findByLabelText('External API key cards');
    expect(within(cards).getByText('External Client')).toBeInTheDocument();
    expect(within(cards).getByLabelText('Movie rating ceiling PG-13')).toBeInTheDocument();
    expect(within(cards).getByLabelText('TV rating ceiling TV-14')).toBeInTheDocument();
    expect(within(cards).getByText('Videos')).toBeInTheDocument();
    expect(within(cards).getByText('Channels · Auto')).toBeInTheDocument();
    expect(within(cards).getByText('Delete video')).toBeInTheDocument();
    expect(within(cards).getByText('1 approved channel')).toBeInTheDocument();
    expect(within(cards).getByText(/Last used/i)).toBeInTheDocument();
    expect(within(cards).queryByText('12 uses')).not.toBeInTheDocument();
    expect(screen.queryByText('client1234...')).not.toBeInTheDocument();
  });

  test('warns prominently when an external key has no effective channel grants', async () => {
    installDefaultFetch([{ ...externalKey, channel_grant_count: 0 }]);
    renderWithProviders(<ApiKeysSection {...props()} />);

    const cards = await screen.findByLabelText('External API key cards');
    expect(within(cards).getByText('0 approved channels')).toBeInTheDocument();
    expect(within(cards).getByText(/No approved channels\. This key cannot view or request catalog content/i))
      .toBeInTheDocument();
  });

  test('uses a neutral state when an older management response omits the grant count', async () => {
    const { channel_grant_count: _omitted, ...olderExternalKey } = externalKey;
    installDefaultFetch([olderExternalKey]);
    renderWithProviders(<ApiKeysSection {...props()} />);

    const cards = await screen.findByLabelText('External API key cards');
    expect(within(cards).getByText('Approved channel count unavailable')).toBeInTheDocument();
    expect(within(cards).queryByText(/No approved channels\./i)).not.toBeInTheDocument();
  });

  test('filters active external keys by default, sorts them alphabetically, and supports search and all-keys mode', async () => {
    const alphaKey = {
      ...externalKey,
      id: 9,
      name: 'Alpha Client',
    };
    const revokedKey = {
      ...externalKey,
      id: 10,
      name: 'Revoked Client',
      is_active: false,
      revoked_at: '2026-07-28T12:00:00.000Z',
    };
    const inactiveKey = {
      ...externalKey,
      id: 11,
      name: 'Inactive Client',
      is_active: false,
    };
    installDefaultFetch([externalKey, alphaKey, revokedKey, inactiveKey]);
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    const cards = await screen.findByLabelText('External API key cards');
    expect(within(cards).getByText('Alpha Client')).toBeInTheDocument();
    expect(within(cards).getByText('External Client')).toBeInTheDocument();
    expect(within(cards).queryByText('Revoked Client')).not.toBeInTheDocument();
    expect(within(cards).queryByText('Inactive Client')).not.toBeInTheDocument();
    const alphaName = within(cards).getByText('Alpha Client');
    const externalName = within(cards).getByText('External Client');
    expect(alphaName.compareDocumentPosition(externalName) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Active only' }));
    expect(within(cards).getByText('Revoked Client')).toBeInTheDocument();
    expect(within(cards).getByText('Inactive Client')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search external access keys'), 'revoked');
    expect(within(cards).getByText('Revoked Client')).toBeInTheDocument();
    expect(within(cards).queryByText('Alpha Client')).not.toBeInTheDocument();
  });

  test('keeps legacy controls and keys in the bottom section', async () => {
    renderWithProviders(<ApiKeysSection {...props()} />);

    const legacyRows = await screen.findByLabelText('Legacy API key rows');
    expect(within(legacyRows).getByText('My Bookmarklet')).toBeInTheDocument();
    expect(within(legacyRows).getByText('Legacy download')).toBeInTheDocument();
    expect(screen.getByLabelText('Legacy rate limit (requests/min)')).toHaveValue(10);
  });

  test('shows separate empty states for external and legacy keys', async () => {
    installDefaultFetch([]);
    renderWithProviders(<ApiKeysSection {...props()} />);

    expect(await screen.findByText('No external access keys yet.')).toBeInTheDocument();
    expect(screen.getByText('No legacy download keys.')).toBeInTheDocument();
  });

  test('shows auto-approve only after its permission is enabled', async () => {
    const viewOnly = {
      ...externalKey,
      role: 'view',
      allow_video_requests: false,
      allow_channel_requests: false,
      allow_delete_video_requests: false,
      auto_approve_video_requests: false,
      auto_approve_channel_requests: false,
      auto_approve_delete_requests: false,
    };
    installDefaultFetch([viewOnly]);
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    await user.click(await screen.findByRole('button', {
      name: 'Edit External Client external access',
    }));
    expect(screen.queryByLabelText('Auto-approve request videos')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Request videos'));
    expect(screen.getByLabelText('Auto-approve request videos')).toBeInTheDocument();
    expect(screen.getByLabelText('Request videos')).toHaveAttribute('data-state', 'checked');
  });

  test('saves independent permissions and channel grants atomically', async () => {
    const viewOnly = {
      ...externalKey,
      role: 'view',
      allow_video_requests: false,
      allow_channel_requests: false,
      allow_delete_video_requests: false,
      auto_approve_video_requests: false,
      auto_approve_channel_requests: false,
      auto_approve_delete_requests: false,
    };
    installDefaultFetch([viewOnly]);
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    await user.click(await screen.findByRole('button', {
      name: 'Edit External Client external access',
    }));
    await user.click(screen.getByLabelText('Request videos'));
    await user.click(screen.getByLabelText('Safe Channel'));
    await user.click(screen.getByRole('button', { name: 'Save External Access' }));

    await waitFor(() => expect(mockFetch.mock.calls.some(([url, init]) =>
      url === '/api/keys/7/external-access' && init?.method === 'PUT'
    )).toBe(true));
    const call = mockFetch.mock.calls.find(([url, init]) =>
        url === '/api/keys/7/external-access' && init?.method === 'PUT'
    );
    const requestBody = JSON.parse(call?.[1]?.body as string);
    expect(requestBody).toEqual({
      policy: expect.objectContaining({
        role: 'request',
        allowVideoRequests: true,
        allowChannelRequests: false,
        allowDeleteVideoRequests: false,
        autoApproveVideoRequests: false,
      }),
      channelIds: [12],
    });
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  test('selects and clears all approved channels when creating a key', async () => {
    installDefaultFetch([]);
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    await user.click(await screen.findByRole('button', { name: 'Create external key' }));
    expect(screen.getByText(/Saving with zero approved channels is allowed, but the key will fail closed/i))
      .toBeInTheDocument();
    const selectAll = await screen.findByLabelText('Select all approved channels');
    await user.click(selectAll);
    expect(screen.getByLabelText('Safe Channel')).toBeChecked();
    expect(screen.getByText('Approved channels (1)')).toBeInTheDocument();
    await user.click(selectAll);
    expect(screen.getByLabelText('Safe Channel')).not.toBeChecked();
  });

  test('selects all approved channels when editing a key', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    await user.click(await screen.findByRole('button', {
      name: 'Edit External Client external access',
    }));
    expect(await screen.findByText(/Saving with zero approved channels is allowed, but this key will fail closed/i))
      .toBeInTheDocument();
    await user.click(await screen.findByLabelText('Select all approved channels'));
    expect(screen.getByLabelText('Safe Channel')).toBeChecked();
  });

  test('turning off a permission also turns off its auto-approval', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    await user.click(await screen.findByRole('button', {
      name: 'Edit External Client external access',
    }));
    expect(screen.getByLabelText('Auto-approve request channels'))
      .toHaveAttribute('data-state', 'checked');
    await user.click(screen.getByLabelText('Request channels'));
    expect(screen.queryByLabelText('Auto-approve request channels')).not.toBeInTheDocument();
  });

  test('creates an external key as view-only by default', async () => {
    installDefaultFetch([]);
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    await user.click(await screen.findByRole('button', { name: 'Create external key' }));
    expect(screen.getByText('Create External Access Key')).toBeInTheDocument();
    expect(screen.getByText('View included')).toBeInTheDocument();
    expect(screen.getByLabelText('Request videos')).toHaveAttribute('data-state', 'unchecked');

    await user.type(screen.getByLabelText('Key Name'), 'New Key');
    await user.click(screen.getByRole('button', { name: /^Create$/ }));

    await waitFor(() => {
      const call = mockFetch.mock.calls.find(([url, init]) =>
        url === '/api/keys' && init?.method === 'POST'
      );
      const requestBody = JSON.parse(call?.[1]?.body as string);
      expect(requestBody.policy).toEqual(expect.objectContaining({
        role: 'view',
        allowVideoRequests: false,
        allowChannelRequests: false,
        allowDeleteVideoRequests: false,
      }));
    });
    expect(await screen.findByText(/API Key Created/)).toBeInTheDocument();
  });

  test('creates legacy keys without an external policy', async () => {
    installDefaultFetch([]);
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    await user.click(await screen.findByRole('button', { name: 'Create legacy key' }));
    expect(screen.getByText('Create Legacy Download Key')).toBeInTheDocument();
    expect(screen.queryByText('Request permissions')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Key Name'), 'Bookmarklet');
    await user.click(screen.getByRole('button', { name: /^Create$/ }));

    await waitFor(() => {
      const call = mockFetch.mock.calls.find(([url, init]) =>
        url === '/api/keys' && init?.method === 'POST'
      );
      expect(JSON.parse(call?.[1]?.body as string)).toEqual({ name: 'Bookmarklet' });
    });
    expect(await screen.findByText(/API endpoint:/)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/api/videos/download`)).toBeInTheDocument();
    expect(screen.queryByText(/Add to Bookmarks/)).not.toBeInTheDocument();
    expect(screen.queryByText(/bookmarklet code/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mobile \/ Shortcuts/)).not.toBeInTheDocument();
  });

  test('changes the legacy rate limit', async () => {
    const onRateLimitChange = jest.fn();
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} onRateLimitChange={onRateLimitChange} />);

    const input = await screen.findByLabelText('Legacy rate limit (requests/min)');
    await user.tripleClick(input);
    await user.keyboard('15');
    expect(onRateLimitChange).toHaveBeenCalled();
  });

  test('revokes an active key after confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    await user.click(await screen.findByRole('button', { name: 'Revoke External Client' }));
    expect(screen.getByText('Revoke API Key?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Revoke$/ }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/keys/7',
      expect.objectContaining({ method: 'DELETE' })
    ));
  });

  test('regenerates a key only after the safeguard dialog and shows it once', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    await user.click(await screen.findByRole('button', { name: 'Regenerate External Client' }));
    expect(screen.getByText('Regenerate API Key?')).toBeInTheDocument();
    expect(screen.getByText(/current key will stop working immediately/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Regenerate Key' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/keys/7/regenerate',
      expect.objectContaining({ method: 'POST' })
    ));
    expect(await screen.findByText(/API Key Regenerated/)).toBeInTheDocument();
    expect(screen.getByText(createdKey.key)).toBeInTheDocument();
  });

  test('shows API loading failures and allows dismissing the alert', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Failed to fetch API keys' }, false));
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysSection {...props()} />);

    expect(await screen.findByText('Failed to fetch API keys')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Failed to fetch API keys')).not.toBeInTheDocument();
  });

  test('does not show the insecure-network warning on localhost', async () => {
    renderWithProviders(<ApiKeysSection {...props()} />);
    await screen.findByText('External access keys');
    expect(screen.queryByText(/Creating API keys over HTTP is insecure/i)).not.toBeInTheDocument();
  });
});
