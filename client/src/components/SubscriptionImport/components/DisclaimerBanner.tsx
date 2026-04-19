import React from 'react';
import { Alert, Typography } from '../../ui';

const DisclaimerBanner: React.FC = () => (
  <Alert severity="info" className="mb-4">
    <Typography variant="body2">
      Channel details like exact folder name and description are populated during import.
      Available tabs (Videos / Shorts / Streams) are detected when you first visit each
      channel&apos;s page after import.
    </Typography>
  </Alert>
);

export default DisclaimerBanner;
