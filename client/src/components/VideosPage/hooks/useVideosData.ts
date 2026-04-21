import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { EnabledChannel, PaginatedVideosResponse, VideoData } from '../../../types/VideoData';

export interface UseVideosDataParams {
  token: string | null;
  page: number;
  videosPerPage: number;
  orderBy: 'published' | 'added';
  sortOrder: 'asc' | 'desc';
  search: string;
  channelFilter: string;
  dateFrom: string;
  dateTo: string;
  maxRatingFilter: string;
  protectedFilter: boolean;
  useInfiniteScroll: boolean;
}

export interface UseVideosDataResult {
  videos: VideoData[];
  setVideos: React.Dispatch<React.SetStateAction<VideoData[]>>;
  totalVideos: number;
  totalPages: number;
  uniqueChannels: string[];
  enabledChannels: EnabledChannel[];
  loading: boolean;
  loadError: string | null;
  refetch: () => Promise<void>;
}

function mergeUniqueById(existing: VideoData[], incoming: VideoData[]): VideoData[] {
  const merged = [...existing, ...incoming];
  const seen = new Set<number>();
  return merged.filter((video) => {
    if (seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  });
}

export function useVideosData({
  token,
  page,
  videosPerPage,
  orderBy,
  sortOrder,
  search,
  channelFilter,
  dateFrom,
  dateTo,
  maxRatingFilter,
  protectedFilter,
  useInfiniteScroll,
}: UseVideosDataParams): UseVideosDataResult {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [uniqueChannels, setUniqueChannels] = useState<string[]>([]);
  const [enabledChannels, setEnabledChannels] = useState<EnabledChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const latestRequestId = useRef(0);

  const fetchVideos = useCallback(async () => {
    if (!token) return;

    const requestId = ++latestRequestId.current;
    setLoading(true);
    setLoadError(null);

    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', videosPerPage.toString());
    params.append('sortBy', orderBy === 'published' ? 'published' : 'added');
    params.append('sortOrder', sortOrder);
    if (search) params.append('search', search);
    if (channelFilter) params.append('channelFilter', channelFilter);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (maxRatingFilter) params.append('maxRating', maxRatingFilter);
    if (protectedFilter) params.append('protectedFilter', 'true');

    try {
      const response = await axios.get<PaginatedVideosResponse>(
        `/getVideos?${params.toString()}`,
        {
          headers: {
            'x-access-token': token,
          },
        }
      );

      if (requestId !== latestRequestId.current) {
        return;
      }

      const incomingVideos = response.data.videos || [];
      setVideos((prev) => {
        if (!useInfiniteScroll || page <= 1) {
          return incomingVideos;
        }
        return mergeUniqueById(prev, incomingVideos);
      });
      setTotalVideos(response.data.total);
      setTotalPages(response.data.totalPages);
      setUniqueChannels(response.data.channels || []);
      setEnabledChannels(response.data.enabledChannels || []);
    } catch (error) {
      if (requestId !== latestRequestId.current) {
        return;
      }
      console.error('Failed to fetch videos:', error);
      setLoadError(
        'Failed to load videos. Please try refreshing the page. If this error persists, the Youtarr backend may be down.'
      );
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [
    token,
    page,
    videosPerPage,
    orderBy,
    sortOrder,
    search,
    channelFilter,
    dateFrom,
    dateTo,
    maxRatingFilter,
    protectedFilter,
    useInfiniteScroll,
  ]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return {
    videos,
    setVideos,
    totalVideos,
    totalPages,
    uniqueChannels,
    enabledChannels,
    loading,
    loadError,
    refetch: fetchVideos,
  };
}
