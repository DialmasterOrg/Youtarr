import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CookieFileCard } from '../CookieFileCard';
import { renderWithProviders } from '../../../../../test-utils';
import { CookieDetails, CookieStatus } from '../../../types';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: (err: unknown): boolean =>
    typeof err === 'object' && err !== null && (err as { isAxiosError?: boolean }).isAxiosError === true,
}));

const axios = require('axios');

const createDetails = (overrides: Partial<CookieDetails> = {}): CookieDetails => ({
  loginCookiesFound: 10,
  sessionLoginCookies: 0,
  expiredLoginCookies: 0,
  earliestExpiry: '2027-10-19T12:00:00.000Z',
  earliestExpiryName: 'HSID',
  lastModified: '2026-09-18T22:40:30.384Z',
  ...overrides,
});

const createStatus = (overrides: Partial<CookieStatus> = {}): CookieStatus => ({
  cookiesEnabled: true,
  customCookiesUploaded: true,
  customFileExists: true,
  details: createDetails(),
  ...overrides,
});

const external = {
  path: '/app/config/cookies.external.txt',
  ready: true,
  lastModified: '2026-09-20T10:00:00.000Z',
  warning: null,
  error: null,
};

const renderCard = (status: CookieStatus, props: Partial<React.ComponentProps<typeof CookieFileCard>> = {}) => {
  const handlers = { onUpload: jest.fn().mockResolvedValue(undefined), onDelete: jest.fn(), onRefresh: jest.fn() };
  renderWithProviders(
    <CookieFileCard token="t" cookieStatus={status} cookiesEnabled uploading={false} {...handlers} {...props} />
  );
  return handlers;
};

describe('CookieFileCard', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('details', () => {
    test('lists the login cookie count and earliest expiry', () => {
      renderCard(createStatus());

      expect(screen.getByText('10 found')).toBeInTheDocument();
      expect(screen.getByText(/\(HSID\)$/)).toBeInTheDocument();
    });

    test('shows Not tested until a test runs', () => {
      renderCard(createStatus());

      expect(screen.getAllByText('Not tested')).toHaveLength(2);
    });

    test('warns and badges the file when login cookies have expired', () => {
      renderCard(createStatus({ details: createDetails({ expiredLoginCookies: 2, earliestExpiryName: 'SID' }) }));

      expect(screen.getByText('Expired')).toBeInTheDocument();
      expect(screen.getByText(/2 login cookies expired/)).toBeInTheDocument();
    });

    test('warns when no login cookies are found', () => {
      renderCard(createStatus({ details: createDetails({ loginCookiesFound: 0, earliestExpiry: null, earliestExpiryName: null }) }));

      expect(screen.getByText('No login cookies')).toBeInTheDocument();
      expect(screen.getByText(/exported from a signed-out/)).toBeInTheDocument();
    });

    test('describes session-only login cookies instead of showing a date', () => {
      renderCard(createStatus({
        details: createDetails({ sessionLoginCookies: 3, loginCookiesFound: 3, earliestExpiry: null, earliestExpiryName: null }),
      }));

      expect(screen.getByText('Session cookies only')).toBeInTheDocument();
      expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    test('offers an upload with the throwaway-account warning', () => {
      renderCard(createStatus({ customFileExists: false, details: null }));

      expect(screen.getByRole('button', { name: 'Upload cookie file' })).toBeEnabled();
      expect(screen.getByText('Use a throwaway account')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Test cookies' })).not.toBeInTheDocument();
    });

    test('shows the uploading state', () => {
      renderCard(createStatus({ customFileExists: false, details: null }), { uploading: true });

      expect(screen.getByRole('button', { name: 'Uploading...' })).toBeDisabled();
    });
  });

  describe('external file', () => {
    test('shows the source path and a refresh action instead of upload controls', async () => {
      const user = userEvent.setup();
      const { onRefresh } = renderCard(createStatus({ external }));

      expect(screen.getByText(external.path)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Replace file' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Refresh file status' }));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    test('badges an unusable external file', () => {
      renderCard(createStatus({ external: { ...external, ready: false, error: 'External cookies: the file was not found.' }, details: null }));

      expect(screen.getByText('Unavailable')).toBeInTheDocument();
      expect(screen.getByText('External cookies: the file was not found.')).toBeInTheDocument();
    });
  });

  describe('test button', () => {
    test('is disabled until enabled cookies are saved', () => {
      renderCard(createStatus({ cookiesEnabled: false, details: null }));

      expect(screen.getByRole('button', { name: 'Test cookies' })).toBeDisabled();
      expect(screen.getByText('Save your settings with cookies enabled to test them.')).toBeInTheDocument();
    });

    test('is disabled when no usable file is active', () => {
      renderCard(createStatus({ details: null }));

      expect(screen.getByRole('button', { name: 'Test cookies' })).toBeDisabled();
      expect(screen.getByText('No usable cookie file is active.')).toBeInTheDocument();
    });

    test('is disabled while a test is running', async () => {
      const user = userEvent.setup();
      axios.post.mockReturnValueOnce(new Promise(() => undefined));
      renderCard(createStatus());

      await user.click(screen.getByRole('button', { name: 'Test cookies' }));

      expect(await screen.findByRole('button', { name: 'Testing...' })).toBeDisabled();
    });

    test('badges the file as signed in after a passing test', async () => {
      const user = userEvent.setup();
      axios.post.mockResolvedValueOnce({ data: { ok: true, message: 'Signed in.' } });
      renderCard(createStatus());

      await user.click(screen.getByRole('button', { name: 'Test cookies' }));

      expect(await screen.findByText('Signed in')).toBeInTheDocument();
    });

    test('shows the classified failure message', async () => {
      const user = userEvent.setup();
      axios.post.mockResolvedValueOnce({ data: { ok: false, code: 'EXPIRED_COOKIES', error: 'YouTube did not recognize a signed-in session.' } });
      renderCard(createStatus());

      await user.click(screen.getByRole('button', { name: 'Test cookies' }));

      expect(await screen.findByText('YouTube did not recognize a signed-in session.')).toBeInTheDocument();
      expect(screen.getByText('Test failed')).toBeInTheDocument();
    });
  });

  test('calls onDelete from the delete action', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderCard(createStatus());

    await user.click(screen.getByRole('button', { name: 'Delete file' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
