import React, { useState } from 'react';
import { Button, Card, CardContent, CardHeader, Grid, Box } from '@mui/material';
import DownloadSettingsDialog from './ManualDownload/DownloadSettingsDialog';
import { DownloadSettings } from './ManualDownload/types';
import ErrorBoundary from '../ErrorBoundary';
import { useConfig } from '../../hooks/useConfig';

interface DownloadChannelPageProps {
  token: string | null;
  fetchRunningJobs: () => void;
  downloadInitiatedRef: React.MutableRefObject<boolean>;
}

const DownloadChannelPage: React.FC<DownloadChannelPageProps> = ({
  token,
  fetchRunningJobs,
  downloadInitiatedRef,
}) => {
  const [showChannelSettingsDialog, setShowChannelSettingsDialog] = useState(false);

  const { config } = useConfig(token);
  const defaultResolution = config.preferredResolution || '1080';
  const defaultVideoCount = config.channelFilesToDownload || 3;

  const handleOpenChannelSettings = () => {
    setShowChannelSettingsDialog(true);
  };

  const handleTriggerChannelDownloads = async (settings: DownloadSettings | null) => {
    setShowChannelSettingsDialog(false);
    downloadInitiatedRef.current = true;

    const body: any = {};
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

    if (result.status === 400) {
      alert('Channel Download already running');
    }

    setTimeout(fetchRunningJobs, 500);
  };

  return (
    <Grid item xs={12} md={12}>
      <Card elevation={8}>
        <CardHeader title="Channel Download" align="center" style={{ marginBottom: '-16px' }} />
        <CardContent>
          <ErrorBoundary
            fallbackMessage="An error occurred with channel downloads. Please refresh the page and try again."
            onReset={() => setShowChannelSettingsDialog(false)}
          >
            <Box
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              gap={2}
              mt={3}
            >
              <Button variant="contained" onClick={handleOpenChannelSettings} size="large">
                Download new from all channels
              </Button>
            </Box>
          </ErrorBoundary>
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

export default DownloadChannelPage;
