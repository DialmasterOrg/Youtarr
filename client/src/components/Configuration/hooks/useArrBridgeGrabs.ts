import { ArrGrab } from '../utils/arrBridgeSetup';
import { ArrPagedList, ArrPagedListSource, useArrBridgePagedList } from './useArrBridgePagedList';

const GRABS: ArrPagedListSource = {
  url: '/api/arr-bridge/grabs',
  itemsKey: 'grabs',
  errorMessage: 'Could not load the recent grabs.',
};

/**
 * The Sonarr/Radarr grabs, newest first, one page at a time.
 * @param token - Session token
 * @param enabled - Whether to load it
 */
export function useArrBridgeGrabs(token: string | null, enabled: boolean): ArrPagedList<ArrGrab> {
  return useArrBridgePagedList<ArrGrab>(GRABS, token, enabled);
}
