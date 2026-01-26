import React, { useCallback } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import ManualDownload from './ManualDownload/ManualDownload';
import { DownloadSettings } from './ManualDownload/types';
import { useConfig } from '../../hooks/useConfig';

interface DownloadManualPageProps {
  token: string | null;
  fetchRunningJobs: () => void;
  downloadInitiatedRef: React.MutableRefObject<boolean>;
}

const DownloadManualPage: React.FC<DownloadManualPageProps> = ({
  token,
  fetchRunningJobs,
  downloadInitiatedRef,
}) => {
  const { config } = useConfig(token);
  const defaultResolution = config.preferredResolution || '1080';

  const handleManualDownload = useCallback(
    async (urls: string[], settings?: DownloadSettings | null) => {
      downloadInitiatedRef.current = true;
      const strippedUrls = urls.map((url) =>
        url.includes('&') ? url.substring(0, url.indexOf('&')) : url
      );

      const body: any = { urls: strippedUrls };
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
    },
    [token, fetchRunningJobs, downloadInitiatedRef]
  );

  return (
    <Grid item xs={12} md={12}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center' }}>
          Manual Download
        </Typography>
        <ManualDownload
          onStartDownload={handleManualDownload}
          token={token}
          defaultResolution={defaultResolution}
        />
      </Box>
    </Grid>
  );
};

export default DownloadManualPage;
