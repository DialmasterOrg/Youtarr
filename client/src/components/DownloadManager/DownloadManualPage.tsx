import React, { useCallback } from 'react';
import { Card, CardContent, CardHeader, Grid } from '@mui/material';
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
      <Card elevation={8}>
        <CardHeader title="Manual Download" align="center" style={{ marginBottom: '-16px' }} />
        <CardContent>
          <ManualDownload
            onStartDownload={handleManualDownload}
            token={token}
            defaultResolution={defaultResolution}
          />
        </CardContent>
      </Card>
    </Grid>
  );
};

export default DownloadManualPage;
