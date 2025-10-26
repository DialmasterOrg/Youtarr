import React, { useState, useCallback, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import ManualDownload from './ManualDownload/ManualDownload';
import DownloadSettingsDialog from './ManualDownload/DownloadSettingsDialog';
import { DownloadSettings } from './ManualDownload/types';
import ErrorBoundary from '../ErrorBoundary';

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
  const [defaultResolution, setDefaultResolution] = useState<string>('1080');
  const [defaultVideoCount, setDefaultVideoCount] = useState<number>(3);
  const [showChannelSettingsDialog, setShowChannelSettingsDialog] = useState(false);

  const handleOpenChannelSettings = () => {
    setShowChannelSettingsDialog(true);
  };

  const handleTriggerChannelDownloads = async (settings: DownloadSettings | null) => {
    setShowChannelSettingsDialog(false);
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
    // If the result is a 400 then we already have a running Channel Download
    // job and we should display an alert
    if (result.status === 400) {
      alert('Channel Download already running');
    }
    setTimeout(fetchRunningJobs, 500);
  };

  const handleManualDownload = useCallback(async (urls: string[], settings?: DownloadSettings | null) => {
    downloadInitiatedRef.current = true;
    const strippedUrls = urls.map((url) =>
      url.includes('&') ? url.substring(0, url.indexOf('&')) : url
    );

    const body: any = { urls: strippedUrls };
    // Add settings to the request body if provided
    if (settings) {
      body.overrideSettings = settings;
    }

    await fetch('/triggerspecificdownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || '',
      },
      body: JSON.stringify(body),
    });

    setTimeout(fetchRunningJobs, 1000);
  }, [token, fetchRunningJobs, downloadInitiatedRef]);

  // Fetch config to get default resolution
  useEffect(() => {
    if (token) {
      fetch('/getconfig', {
        headers: {
          'x-access-token': token,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.preferredResolution) {
            setDefaultResolution(data.preferredResolution);
          }
          if (data.channelFilesToDownload) {
            setDefaultVideoCount(data.channelFilesToDownload);
          }
        })
        .catch((error) => {
          console.error('Error fetching config:', error);
        });
    }
  }, [token]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Grid item xs={12} md={12}>
      <Card elevation={8}>
        <CardHeader
          title='Start Downloads'
          align='center'
          style={{ marginBottom: '-16px' }}
        />
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={tabValue} onChange={handleTabChange} centered>
              <Tab label="Manual Download" />
              <Tab label="Channel Download" />
            </Tabs>
          </Box>

          {tabValue === 0 ? (
            <ErrorBoundary
              fallbackMessage="An error occurred in the download manager. Please refresh the page and try again."
              onReset={() => setTabValue(0)}
            >
              <ManualDownload
                onStartDownload={handleManualDownload}
                token={token}
                defaultResolution={defaultResolution}
              />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary
              fallbackMessage="An error occurred with channel downloads. Please refresh the page and try again."
              onReset={() => setTabValue(1)}
            >
              <Box
                display='flex'
                flexDirection='column'
                justifyContent='center'
                alignItems='center'
                gap={2}
                mt={3}
              >
                <Button
                  variant='contained'
                  onClick={handleOpenChannelSettings}
                  size='large'
                >
                  Download new from all channels
                </Button>
              </Box>
            </ErrorBoundary>
          )}
        </CardContent>
      </Card>

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
