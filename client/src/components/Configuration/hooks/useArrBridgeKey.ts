import { ServerOwnedSecretSource, useServerOwnedSecret } from './useServerOwnedSecret';

const BRIDGE_KEY: ServerOwnedSecretSource = {
  url: '/api/arr-bridge/key',
  regenerateUrl: '/api/arr-bridge/key/regenerate',
  field: 'key',
  loadError: 'Could not load the key.',
};

/**
 * The key Sonarr and Radarr send to Youtarr.
 * @param token - Session token
 * @param enabled - Whether to load it; the server creates the key on first request
 */
export function useArrBridgeKey(token: string | null, enabled: boolean) {
  const { value: bridgeKey, ...rest } = useServerOwnedSecret(BRIDGE_KEY, token, enabled);
  return { bridgeKey, ...rest };
}
