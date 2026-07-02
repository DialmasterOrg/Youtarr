import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  LinearProgress,
} from '../ui';
import {
  Download as DownloadIcon,
  Warning as WarningIcon,
} from '../../lib/icons';
import DownloadSettingsDialog from '../DownloadManager/ManualDownload/DownloadSettingsDialog';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';
import {
  useChannelDownloadAll,
  DownloadAllPreview,
} from './hooks/useChannelDownloadAll';

interface DownloadAllVideosDialogProps {
  open: boolean;
  onClose: () => void;
  channelId?: string;
  token: string | null;
  tabType: string;
  tabLabel: string;
  defaultResolution: string;
  defaultResolutionSource: 'channel' | 'global';
  defaultAudioFormat?: string | null;
  defaultAudioFormatSource?: 'channel' | 'global';
  // Parent-owned full metadata fetch (the "Load More" flow) so the preview
  // count covers the whole channel tab. Resolves null on failure.
  runMetadataFetch: () => Promise<unknown>;
  onStarted: (queued: number) => void;
}

function formatContentDuration(preview: DownloadAllPreview): string | null {
  if (preview.totalDurationSeconds <= 0) return null;
  const totalHours = Math.round(preview.totalDurationSeconds / 3600);
  const amount =
    totalHours >= 1
      ? `${totalHours} hour${totalHours === 1 ? '' : 's'}`
      : `${Math.max(1, Math.round(preview.totalDurationSeconds / 60))} minutes`;
  // Some videos have no known duration, so the real total can only be larger.
  const qualifier = preview.missingDurations > 0 ? 'at least' : 'about';
  return `${qualifier} ${amount} of content`;
}

function DownloadAllVideosDialog({
  open,
  onClose,
  channelId,
  token,
  tabType,
  tabLabel,
  defaultResolution,
  defaultResolutionSource,
  defaultAudioFormat,
  defaultAudioFormatSource,
  runMetadataFetch,
  onStarted,
}: DownloadAllVideosDialogProps) {
  const {
    preview,
    starting,
    error,
    fetchPreview,
    startDownloadAll,
    resetPreview,
  } = useChannelDownloadAll(channelId, token);

  const [step, setStep] = useState<'confirm' | 'settings'>('confirm');
  const [preparing, setPreparing] = useState<boolean>(false);
  const [metadataFetchFailed, setMetadataFetchFailed] = useState<boolean>(false);
  // Ref (not state) so a double-click can't queue two jobs: the second click
  // arrives before React re-renders with any disabled state. Latched on
  // success; reset on failure so the user can retry.
  const submittingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setStep('confirm');
    setMetadataFetchFailed(false);
    setPreparing(true);
    resetPreview();

    (async () => {
      const refreshResult = await runMetadataFetch();
      if (cancelled) return;
      setMetadataFetchFailed(refreshResult === null);
      await fetchPreview(tabType);
      if (cancelled) return;
      setPreparing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tabType, runMetadataFetch, fetchPreview, resetPreview]);

  const handleSettingsConfirm = async (settings: DownloadSettings | null) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    // allowRedownload is intentionally dropped; download-all never re-downloads.
    const overrideSettings = settings
      ? {
          resolution: settings.resolution,
          subfolder: settings.subfolder,
          audioFormat: settings.audioFormat,
          rating: settings.rating,
          skipVideoFolder: settings.skipVideoFolder,
        }
      : undefined;
    const queued = await startDownloadAll(tabType, overrideSettings);
    if (queued === null) {
      // Error state is rendered by the confirm step.
      submittingRef.current = false;
      setStep('confirm');
      return;
    }
    onStarted(queued);
  };

  const contentDuration = preview ? formatContentDuration(preview) : null;
  const canContinue =
    !preparing && !starting && Boolean(preview) && (preview?.count ?? 0) > 0;

  return (
    <>
      <Dialog
        open={open && step === 'confirm'}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WarningIcon size={20} data-testid="WarningIcon" />
          Download All {tabLabel}
        </DialogTitle>

        <DialogContent>
          <div style={{ paddingTop: 8 }}>
            {preparing && (
              <>
                <Typography variant="body2" color="text.secondary" style={{ marginBottom: 16 }}>
                  Loading metadata for all channel videos (up to 5,000). This can
                  take a while for large channels...
                </Typography>
                <LinearProgress />
              </>
            )}

            {!preparing && error && (
              <Alert severity="error" style={{ marginBottom: 16 }}>
                {error}
              </Alert>
            )}

            {!preparing && metadataFetchFailed && (
              <Alert severity="warning" style={{ marginBottom: 16 }}>
                Could not refresh this channel&apos;s video list from YouTube, so
                the download count may be incomplete.
              </Alert>
            )}

            {!preparing && preview && preview.count === 0 && (
              <Alert severity="info">
                Every known video in this tab has already been downloaded.
              </Alert>
            )}

            {!preparing && preview && preview.count > 0 && (
              <>
                <Alert severity="warning" style={{ marginBottom: 16 }}>
                  <Typography variant="body2">
                    You are about to download {preview.count} videos
                    {contentDuration ? ` (${contentDuration})` : ''}. This could
                    take many hours or even days, depending on the number of
                    videos and your connection speed.
                  </Typography>
                </Alert>

                <Typography variant="body2" color="text.secondary" style={{ marginBottom: 8 }}>
                  Before you continue:
                </Typography>
                <ul style={{ marginLeft: 16, marginBottom: 8 }}>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Previously downloaded videos (including any you have since
                    deleted) are not included.
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Youtarr runs one download job at a time, so all other
                    downloads (including scheduled channel downloads) will wait
                    until this finishes.
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    You can cancel any time from the Downloads page: videos
                    already downloaded are kept, and running Download All again
                    picks up where it left off.
                  </Typography>
                </ul>
              </>
            )}
          </div>
        </DialogContent>

        <DialogActions style={{ paddingLeft: 24, paddingRight: 24, paddingBottom: 16 }}>
          <Button onClick={onClose} variant="contained" color="primary" autoFocus>
            Cancel
          </Button>
          <Button
            onClick={() => setStep('settings')}
            variant="outlined"
            color="primary"
            disabled={!canContinue}
            startIcon={<DownloadIcon size={16} />}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <DownloadSettingsDialog
        open={open && step === 'settings'}
        onClose={onClose}
        onConfirm={handleSettingsConfirm}
        videoCount={preview?.count}
        defaultResolution={defaultResolution}
        defaultResolutionSource={defaultResolutionSource}
        defaultAudioFormat={defaultAudioFormat}
        defaultAudioFormatSource={defaultAudioFormatSource}
        mode="manual"
        token={token}
        hideRedownloadOption
      />
    </>
  );
}

export default DownloadAllVideosDialog;
