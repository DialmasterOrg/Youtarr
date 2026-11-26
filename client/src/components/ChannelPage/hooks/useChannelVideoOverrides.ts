import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChannelVideo, MembersAccessState } from '../../../types/ChannelVideo';

interface AvailabilityOverride {
  availability: string | null;
  members_access?: MembersAccessState | null;
}

interface UseChannelVideoOverridesResult {
  // The rows with every local change applied.
  videos: ChannelVideo[];
  setIgnored: (ignoredById: Record<string, boolean>) => void;
  setProtected: (youtubeId: string, isProtected: boolean) => void;
  setAvailability: (
    youtubeId: string,
    availability: string | null,
    membersAccess?: MembersAccessState | null
  ) => void;
  setPublishedAt: (youtubeId: string, isoDate: string) => void;
}

interface UseChannelVideoOverridesParams {
  videos: ChannelVideo[];
  // Changes whenever the list restarts from its first page.
  resetKey: string;
  page: number;
  // Infinite scroll: a later page is added below the rows already loaded.
  appendsPages: boolean;
}

// Changes made on this page that the loaded rows do not show yet: an ignore
// or protection toggle, and what opening a video found out about it.
//
// Ignore and protection are dropped whenever the list is replaced by a newly
// loaded one, which carries the saved values: on a new resetKey and on a page
// change. The exception is a later page of an infinite list, which is added
// below rows that stay on screen and still need their changes. Going back to
// its first page replaces the list like any other page change. A reload of
// the page already showing keeps them, because it can answer before a toggle
// still being saved.
//
// What was found out about a video stays true however the list is loaded, so
// it is kept.
export function useChannelVideoOverrides({
  videos,
  resetKey,
  page,
  appendsPages,
}: UseChannelVideoOverridesParams): UseChannelVideoOverridesResult {
  const [ignoredById, setIgnoredById] = useState<Record<string, boolean>>({});
  const [protectedById, setProtectedById] = useState<Record<string, boolean>>({});
  const [availabilityById, setAvailabilityById] = useState<Record<string, AvailabilityOverride>>({});
  const [publishedAtById, setPublishedAtById] = useState<Record<string, string>>({});

  const dropToggles = useCallback(() => {
    setIgnoredById({});
    setProtectedById({});
  }, []);

  useEffect(() => {
    dropToggles();
  }, [resetKey, dropToggles]);

  useEffect(() => {
    if (appendsPages && page > 1) return;
    dropToggles();
  }, [page, appendsPages, dropToggles]);

  const setIgnored = useCallback((updates: Record<string, boolean>) => {
    setIgnoredById((prev) => ({ ...prev, ...updates }));
  }, []);

  const setProtected = useCallback((youtubeId: string, isProtected: boolean) => {
    setProtectedById((prev) => ({ ...prev, [youtubeId]: isProtected }));
  }, []);

  const setAvailability = useCallback(
    (youtubeId: string, availability: string | null, membersAccess?: MembersAccessState | null) => {
      setAvailabilityById((prev) => ({
        ...prev,
        [youtubeId]: { availability, members_access: membersAccess },
      }));
    },
    []
  );

  const setPublishedAt = useCallback((youtubeId: string, isoDate: string) => {
    setPublishedAtById((prev) => ({ ...prev, [youtubeId]: isoDate }));
  }, []);

  const videosWithOverrides = useMemo(
    () =>
      videos.map((video) => {
        const id = video.youtube_id;
        const hasIgnored = id in ignoredById;
        const hasProtected = id in protectedById;
        const hasAvailability = id in availabilityById;
        const hasPublishedAt = id in publishedAtById;
        if (!hasIgnored && !hasProtected && !hasAvailability && !hasPublishedAt) return video;
        return {
          ...video,
          ...(hasIgnored
            ? {
                ignored: ignoredById[id],
                ignored_at: ignoredById[id] ? new Date().toISOString() : null,
              }
            : {}),
          ...(hasProtected ? { protected: protectedById[id] } : {}),
          ...(hasAvailability ? availabilityById[id] : {}),
          ...(hasPublishedAt
            ? { publishedAt: publishedAtById[id], published_at_source: 'exact' as const }
            : {}),
        };
      }),
    [videos, ignoredById, protectedById, availabilityById, publishedAtById]
  );

  return { videos: videosWithOverrides, setIgnored, setProtected, setAvailability, setPublishedAt };
}
