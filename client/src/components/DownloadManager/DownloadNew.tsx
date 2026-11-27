import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  CardHeader,
  Grid,
  Tabs,
  Tab,
  Typography,
} from '../ui';
import ManualDownload from './ManualDownload/ManualDownload';
import DownloadSettingsDialog from './ManualDownload/DownloadSettingsDialog';
import { DownloadSettings } from './ManualDownload/types';
import ErrorBoundary from '../ErrorBoundary';
import { useConfig } from '../../hooks/useConfig';
import { useTriggerDownloads } from '../../hooks/useTriggerDownloads';

const API_KEYS_SETTINGS_PATH = '/settings/api-keys';
interface DownloadNewProps {
  videoUrls: string;
  setVideoUrls: React.Dispatch<React.SetStateAction<string>>;
  token: string | null;
  fetchRunningJobs: () => void;
  downloadInitiatedRef: React.MutableRefObject<boolean>;
}

const DownloadNew: React.FC<DownloadNewProps> = ({
  videoUrls,
  setVideoUrls,
  token,
  fetchRunningJobs,
  downloadInitiatedRef,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [showChannelSettingsDialog, setShowChannelSettingsDialog] = useState(false);
  const [channelDownloadError, setChannelDownloadError] = useState<string | null>(null);
  const navigate = useNavigate();
  // ManualDownload guards its own double submit, but a tab switch remounts it
  // while a request is still out; a batch submitted then must still be sent.
  const { triggerDownloads } = useTriggerDownloads(token, { allowOverlap: true });

  // Use config hook to get default resolution and video count
  const { config } = useConfig(token);
  const defaultResolution = config.preferredResolution || '1080';
  const defaultVideoCount = config.channelFilesToDownload || 3;

  const handleOpenChannelSettings = () => {
    setShowChannelSettingsDialog(true);
  };

  const handleTriggerChannelDownloads = async (settings: DownloadSettings | null) => {
    setShowChannelSettingsDialog(false);
    setChannelDownloadError(null);
    downloadInitiatedRef.current = true;

    const body: any = {};
    // Add settings to the request body if provided
    if (settings) {
      body.overrideSettings = settings;
    }

    const result = await fetch('/triggerchanneldownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || '',
      },
      body: JSON.stringify(body),
    });
    if (!result.ok) {
      const data: { error?: string } = await result.json().catch(() => ({}));
      setChannelDownloadError(data.error || 'Could not start channel downloads.');
      return;
    }
    navigate('/downloads/activity');
    setTimeout(fetchRunningJobs, 500);
  };

  const handleManualDownload = useCallback(async (
    urls: string[],
    settings?: DownloadSettings | null,
    videoChannelMap?: Record<string, string>
  ) => {
    const strippedUrls = urls.map((url) =>
      url.includes('&') ? url.substring(0, url.indexOf('&')) : url
    );

    const result = await triggerDownloads({
      urls: strippedUrls,
      overrideSettings: settings ?? undefined,
      videoChannelMap,
    });
    // ManualDownload shows a rejection's message and keeps its list, so only a
    // queued batch may resolve.
    if (!result?.ok) throw new Error(result?.message);

    downloadInitiatedRef.current = true;
    setTimeout(fetchRunningJobs, 1000);
    navigate('/downloads/activity');
  }, [triggerDownloads, fetchRunningJobs, downloadInitiatedRef, navigate]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Grid item xs={12} md={12}>
      <div>
        <CardHeader
          title='Start Downloads'
          align='center'
          className="px-0 pt-0"
          style={{ marginBottom: '-16px' }}
        />
        <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <Tabs value={tabValue} onChange={handleTabChange} centered>
            <Tab label="Manual Download" />
            <Tab label="Channel/Playlist Downloads" />
          </Tabs>
        </div>

        {tabValue === 0 ? (
          <ErrorBoundary
            fallbackMessage="An error occurred in the download manager. Please refresh the page and try again."
            onReset={() => setTabValue(0)}
          >
            <ManualDownload
              onStartDownload={handleManualDownload}
              token={token}
              defaultResolution={defaultResolution}
              defaultProtect={config.protectManualDownloads}
            />
            <Typography variant="body2" color="text.secondary" className="mb-4">
              Tip: queue videos right from YouTube with the "Send to Youtarr" browser bookmarklet or a phone
              shortcut.{' '}
              <Link className="underline font-medium" to={API_KEYS_SETTINGS_PATH}>
                Set up the bookmarklet
              </Link>
            </Typography>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary
            fallbackMessage="An error occurred with channel downloads. Please refresh the page and try again."
            onReset={() => setTabValue(1)}
          >
            {channelDownloadError && (
              <Alert severity="warning" onClose={() => setChannelDownloadError(null)} className="mb-2">
                {channelDownloadError}
              </Alert>
            )}
            <div
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24 }}
            >
              <Button
                variant='contained'
                onClick={handleOpenChannelSettings}
                size='large'
              >
                Download new from all channels/playlists
              </Button>
            </div>
          </ErrorBoundary>
        )}
      </div>

      <DownloadSettingsDialog
        open={showChannelSettingsDialog}
        onClose={() => setShowChannelSettingsDialog(false)}
        onConfirm={handleTriggerChannelDownloads}
        defaultResolution={defaultResolution}
        defaultVideoCount={defaultVideoCount}
        mode="channel"
        defaultResolutionSource="global"
      />
    </Grid>
  );
};

export default DownloadNew;
