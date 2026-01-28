import React, { useState } from 'react';
import { Button, Grid, Box, Typography } from '@mui/material';
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center' }}>
          Channel Download
        </Typography>
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
            <Button 
              variant="contained" 
              onClick={handleOpenChannelSettings} 
              size="large"
              sx={{
                color: '#ffffff',
                '&:hover': {
                  color: '#ffffff',
                }
              }}
            >
              Download new from all channels
            </Button>
          </Box>
        </ErrorBoundary>
      </Box>

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
