import { ServerOwnedSecretSource, useServerOwnedSecret } from './useServerOwnedSecret';

const FEED_TOKEN: ServerOwnedSecretSource = {
  url: '/api/feeds/downloads/token',
  regenerateUrl: '/api/feeds/downloads/regenerate-token',
  field: 'token',
  loadError: 'Could not load the feed URL.',
};

/**
 * The secret in the download feed URL.
 * @param token - Session token
 * @param enabled - Whether to load it; the server creates the token on first request
 */
export function useDownloadsFeedToken(token: string | null, enabled: boolean) {
  const { value: feedToken, ...rest } = useServerOwnedSecret(FEED_TOKEN, token, enabled);
  return { feedToken, ...rest };
}
