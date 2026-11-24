import { ArrSearch } from '../utils/arrBridgeSearches';
import { ArrPagedList, ArrPagedListSource, useArrBridgePagedList } from './useArrBridgePagedList';

const SEARCHES: ArrPagedListSource = {
  url: '/api/arr-bridge/searches',
  itemsKey: 'searches',
  errorMessage: 'Could not load the recent searches.',
};

/**
 * The searches Sonarr and Radarr sent, newest first, one page at a time.
 * @param token - Session token
 * @param enabled - Whether to load it
 */
export function useArrBridgeSearches(token: string | null, enabled: boolean): ArrPagedList<ArrSearch> {
  return useArrBridgePagedList<ArrSearch>(SEARCHES, token, enabled);
}
