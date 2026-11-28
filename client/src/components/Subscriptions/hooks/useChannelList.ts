import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { serverErrorMessage } from '../../../utils/requestError';
import { Channel } from '../../../types/Channel';
import { normalizeSubFolderKey } from '../../../utils/channelHelpers';
import { ALLOWED_PAGE_SIZES } from '../../shared/VideoList/pageSizes';

// The largest page /getchannels serves (MAX_CHANNEL_PAGE_SIZE in channelCatalog.js).
const RELOAD_PAGE_SIZE = Math.max(...ALLOWED_PAGE_SIZES);

interface UseChannelListParams {
  token: string | null;
  page: number;
  pageSize: number;
  searchTerm: string;
  sortOrder: 'asc' | 'desc';
  subFolder?: string;
  append?: boolean;
}

export interface ChannelListResponse {
  channels: ChannelListEntry[];
  total: number;
  totalPages: number;
  subFolders?: Array<string | null>;
}

export type ChannelListEntry = Channel & { database_id: number };

export const useChannelList = ({
  token,
  page,
  pageSize,
  searchTerm,
  sortOrder,
  subFolder,
  append = false,
}: UseChannelListParams) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);
  const [subFolders, setSubFolders] = useState<string[]>([]);
  // Only the newest request may update state: search-as-you-type sends
  // overlapping requests, and an older one can answer last.
  const latestRequestRef = useRef(0);

  const fetchChannels = useCallback(async (reloadLoadedPages = false) => {
    const requestId = ++latestRequestRef.current;
    const isLatest = () => latestRequestRef.current === requestId;

    if (!token) {
      setChannels([]);
      setTotal(0);
      setTotalPages(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // A reload of an appended list requests every loaded row, in as few
    // requests as the server's page limit allows, and replaces the list:
    // merging one reloaded page kept each row's older copy.
    const replaceLoaded = reloadLoadedPages && append && page > 1;
    const loadedCount = page * pageSize;
    const reloadPageSize = Math.min(loadedCount, RELOAD_PAGE_SIZE);
    const requests = replaceLoaded
      ? Array.from({ length: Math.ceil(loadedCount / reloadPageSize) }, (_, index) => ({
        page: index + 1,
        pageSize: reloadPageSize,
      }))
      : [{ page, pageSize }];

    try {
      const responses = await Promise.all(
        requests.map((request) =>
          axios.get<ChannelListResponse>('/getchannels', {
            headers: {
              'x-access-token': token,
            },
            params: {
              ...request,
              search: searchTerm || undefined,
              sortOrder,
              subFolder: subFolder || undefined,
            },
          })
        )
      );

      if (!isLatest()) return;

      const payload = responses[responses.length - 1].data;
      const received = responses.flatMap((response) => response.data.channels || []);
      // Exactly the rows that were loaded, so the next page continues after
      // them; only the last request of a list over the limit returns extra.
      const incomingChannels = replaceLoaded ? received.slice(0, loadedCount) : received;
      setChannels((prev) => {
        if (!append || page <= 1) {
          return incomingChannels;
        }

        const merged = replaceLoaded ? incomingChannels : [...prev, ...incomingChannels];
        const seen = new Set<string>();
        return merged.filter((channel) => {
          const key = channel.channel_id || channel.url;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      });
      setTotal(payload.total || 0);
      setTotalPages(
        replaceLoaded ? Math.ceil((payload.total || 0) / pageSize) : payload.totalPages || 0
      );
      setSubFolders(
        (payload.subFolders || []).map((value) => normalizeSubFolderKey(value)).filter(Boolean)
      );
    } catch (err: unknown) {
      if (!isLatest()) return;
      setError(serverErrorMessage(err, 'Failed to load channels'));
    } finally {
      if (isLatest()) {
        setLoading(false);
      }
    }
  }, [token, page, pageSize, searchTerm, sortOrder, subFolder, append]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Callers hold refetch across an await (a save), so it runs the current
  // render's fetch: one captured earlier would reload the pages loaded back
  // then over a list that has since grown.
  const fetchRef = useRef(fetchChannels);
  fetchRef.current = fetchChannels;
  const refetch = useCallback(() => fetchRef.current(true), []);

  return {
    channels,
    total,
    totalPages,
    loading,
    error,
    refetch,
    subFolders,
  };
};
