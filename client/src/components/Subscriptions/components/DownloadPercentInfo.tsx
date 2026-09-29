import React from 'react';
import { Typography } from '../../ui';
import InfoPopoverButton from '../../shared/InfoPopoverButton';
import { PUBLIC_ONLY_NOTE } from '../../../utils/tabDownloadStats';

// One explanation per page for the tab chips on every channel.
const DownloadPercentInfo: React.FC = () => (
  <InfoPopoverButton ariaLabel="Download percentage info">
    <div className="flex flex-col gap-2">
      <Typography variant="body2">
        Highlighted tabs download automatically. The percentage beside each tab is how much of it
        you have downloaded; hover a tab for the counts.
      </Typography>
      <Typography variant="body2" color="text.secondary">{PUBLIC_ONLY_NOTE}</Typography>
    </div>
  </InfoPopoverButton>
);

export default DownloadPercentInfo;
