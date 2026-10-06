import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { TitleShowDraft, TitleShowPreview } from '../../../types/titleShows';
import { EpisodeOverride } from '../../../types/reorganize';
import { serverMessageOf } from '../../shared/Reorganize/reorganizeErrors';

/** The editor previews once the drafts stop changing for this long. */
export const PREVIEW_DEBOUNCE_MS = 600;

export interface UseTitleShowPreviewResult {
  preview: TitleShowPreview | null;
  loading: boolean;
  /** The server's refusal of the drafts (a bad pattern, a taken folder) */
  error: string | null;
  /** The preview shown is for the drafts as they are now */
  current: boolean;
}

/**
 * The live preview of draft title shows (POST /api/channels/:channelId/tv/preview):
 * the channel's whole set of shows after the edit, classified against every
 * known video of the channel.
 */
export function useTitleShowPreview(
  channelId: string | undefined,
  token: string | null,
  shows: TitleShowDraft[],
  { enabled = true, overrides = [] }: { enabled?: boolean; overrides?: EpisodeOverride[] } = {}
): UseTitleShowPreviewResult {
  const [preview, setPreview] = useState<TitleShowPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewedBody, setPreviewedBody] = useState<string | null>(null);
  const requestSeq = useRef(0);
  // The drafts as a value, so a new array with the same content asks nothing.
  const body = useMemo(() => JSON.stringify({ shows, overrides }), [shows, overrides]);

  useEffect(() => {
    if (!enabled || !token || !channelId) {
      // A request still in flight must not land, and the next show edited
      // must not start from this one's preview.
      requestSeq.current += 1;
      setPreview(null);
      setError(null);
      setLoading(false);
      setPreviewedBody(null);
      return undefined;
    }
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await axios.post<TitleShowPreview>(
          `/api/channels/${encodeURIComponent(channelId)}/tv/preview`,
          JSON.parse(body),
          { headers: { 'x-access-token': token } }
        );
        if (seq !== requestSeq.current) return;
        setPreview(response.data);
        setPreviewedBody(body);
        setError(null);
      } catch (err) {
        if (seq === requestSeq.current) setError(serverMessageOf(err, 'Failed to preview the shows'));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [body, channelId, token, enabled]);

  return { preview, loading, error, current: previewedBody === body && !loading };
}

export default useTitleShowPreview;
