import React, { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CookieConfigSection } from '../CookieConfigSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState, CookieStatus } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

// Exercises the real useCookieManagement hook, so the button state depends on
// what the server responses actually contain.
const noFile: CookieStatus = {
  cookiesEnabled: true,
  customCookiesUploaded: false,
  customFileExists: false,
  details: null,
};

const uploaded: CookieStatus = {
  cookiesEnabled: true,
  customCookiesUploaded: true,
  customFileExists: true,
  details: {
    loginCookiesFound: 10,
    sessionLoginCookies: 0,
    expiredLoginCookies: 0,
    earliestExpiry: '2027-10-19T12:00:00.000Z',
    earliestExpiryName: 'HSID',
    lastModified: '2026-09-25T12:00:00.000Z',
  },
};

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: jest.fn().mockResolvedValueOnce(body) }) as unknown as Response;

const Harness: React.FC = () => {
  const [config, setConfig] = useState<ConfigState>({ ...DEFAULT_CONFIG, cookiesEnabled: true });
  return (
    <CookieConfigSection
      token="token"
      config={config}
      setConfig={setConfig}
      onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
      setSnackbar={jest.fn()}
    />
  );
};

describe('CookieConfigSection upload workflow', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('enables Test cookies right after a file is uploaded', async () => {
    const user = userEvent.setup();
    const mockFetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(noFile))
      .mockResolvedValueOnce(jsonResponse({ status: 'success', cookieStatus: uploaded }));
    global.fetch = mockFetch as unknown as typeof fetch;
    renderWithProviders(<Harness />);

    await user.upload(
      await screen.findByTestId('cookie-file-input'),
      new File(['# Netscape HTTP Cookie File'], 'cookies.txt', { type: 'text/plain' })
    );

    expect(await screen.findByRole('button', { name: 'Test cookies' })).toBeEnabled();
  });
});
