import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const TAB_MEDIA_TYPE: Record<string, string> = {
  videos: 'video',
  shorts: 'short',
  streams: 'livestream',
};

const TAB_LABEL: Record<string, string> = {
  videos: 'Videos',
  shorts: 'Shorts',
  streams: 'Live',
};

export type AutoDownloadToggleSeverity = 'success' | 'warning' | 'error';

export interface AutoDownloadToggleNotice {
  message: string;
  severity: AutoDownloadToggleSeverity;
  // Present only on success: the value to restore when the user clicks Undo.
  undoValue?: string;
}

interface ChannelSettingsResponse {
  settings?: { auto_download_enabled_tabs?: string | null };
}

interface UseAutoDownloadTabToggleParams {
  channelId: string | undefined;
  token: string | null;
  enabledTabs: string | null | undefined;
  // Receives the channel the value was saved for, so the caller can drop a
  // save that finishes after it has moved on to another channel.
  onChange: (enabledTabs: string, channelId: string) => void;
}

interface UseAutoDownloadTabToggleResult {
  saving: boolean;
  notice: AutoDownloadToggleNotice | null;
  toggleTab: (tab: string, enabled: boolean) => Promise<void>;
  undo: () => Promise<void>;
  dismissNotice: () => void;
}

const parseTabs = (csv: string | null | undefined): string[] =>
  (csv || '').split(',').map((entry) => entry.trim()).filter(Boolean);

function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const serverError = (err.response?.data as { error?: unknown } | undefined)?.error;
    if (typeof serverError === 'string' && serverError.length > 0) {
      return `${fallback}: ${serverError}`;
    }
  }
  return fallback;
}

function describeSuccess(label: string, enabled: boolean, saved: string[]): string {
  if (enabled) return `Auto-download on for ${label}`;
  if (saved.length === 0) return 'Auto-download is now off for this channel';
  return `Auto-download off for ${label}`;
}

export function useAutoDownloadTabToggle({
  channelId,
  token,
  enabledTabs,
  onChange,
}: UseAutoDownloadTabToggleParams): UseAutoDownloadTabToggleResult {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<AutoDownloadToggleNotice | null>(null);
  // The page component is reused across channels, so a save that resolves
  // after navigation must not write into the next channel's state.
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
  const savingRef = useRef(false);

  useEffect(() => {
    setNotice(null);
  }, [channelId]);

  const save = useCallback(async (nextValue: string): Promise<string> => {
    const response = await axios.put<ChannelSettingsResponse>(
      `/api/channels/${channelId}/settings`,
      { auto_download_enabled_tabs: nextValue },
      { headers: { 'x-access-token': token || '' } }
    );
    return response.data.settings?.auto_download_enabled_tabs ?? '';
  }, [channelId, token]);

  // Saves run one at a time: each request carries the full list, so letting
  // two overlap could have the older one land last and drop a change.
  const runExclusive = useCallback(async (work: () => Promise<void>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await work();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  const toggleTab = useCallback(async (tab: string, enabled: boolean) => {
    const mediaType = TAB_MEDIA_TYPE[tab];
    if (!channelId || !mediaType) return;
    const label = TAB_LABEL[tab];
    const requestChannelId = channelId;
    const previousValue = parseTabs(enabledTabs).join(',');
    const current = parseTabs(enabledTabs).filter((entry) => entry !== mediaType);
    const nextValue = (enabled ? [...current, mediaType] : current).join(',');

    await runExclusive(async () => {
      // A newer change makes the previous Undo stale: its snapshot would revert this one too.
      setNotice(null);
      onChange(nextValue, requestChannelId);
      try {
        const savedValue = await save(nextValue);
        if (channelIdRef.current !== requestChannelId) return;
        onChange(savedValue, requestChannelId);
        const saved = parseTabs(savedValue);
        // The server drops tabs it has not detected for the channel.
        if (enabled && !saved.includes(mediaType)) {
          setNotice({
            message: `${label} isn't available for this channel. Use Edit to re-detect tabs.`,
            severity: 'warning',
          });
          return;
        }
        setNotice({
          message: describeSuccess(label, enabled, saved),
          severity: 'success',
          undoValue: previousValue,
        });
      } catch (err: unknown) {
        if (channelIdRef.current !== requestChannelId) return;
        onChange(previousValue, requestChannelId);
        setNotice({
          message: getErrorMessage(err, `Couldn't update auto-download for ${label}`),
          severity: 'error',
        });
      }
    });
  }, [channelId, enabledTabs, onChange, save, runExclusive]);

  const undo = useCallback(async () => {
    const undoValue = notice?.undoValue;
    if (!channelId || undoValue === undefined) return;
    const requestChannelId = channelId;

    await runExclusive(async () => {
      setNotice(null);
      try {
        const savedValue = await save(undoValue);
        if (channelIdRef.current !== requestChannelId) return;
        onChange(savedValue, requestChannelId);
      } catch (err: unknown) {
        if (channelIdRef.current !== requestChannelId) return;
        setNotice({
          message: getErrorMessage(err, "Couldn't undo the auto-download change"),
          severity: 'error',
        });
      }
    });
  }, [channelId, notice, onChange, save, runExclusive]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { saving, notice, toggleTab, undo, dismissNotice };
}
