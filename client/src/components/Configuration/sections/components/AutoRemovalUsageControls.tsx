import React from 'react';
import { Box, Grid, Typography } from '../../../ui';
import { InfoTooltip } from '../../common/InfoTooltip';
import { StorageSizeInput } from '../../common/StorageSizeInput';
import { ConfigState } from '../../types';

interface AutoRemovalUsageControlsProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

export const AutoRemovalUsageControls: React.FC<AutoRemovalUsageControlsProps> = ({
  config,
  onConfigChange,
  onMobileTooltipClick,
}) => (
  <Grid item xs={12}>
    <Box className="rounded-lg border border-border p-4">
      <Typography variant="subtitle2" className="mb-3">
        Total size of downloads
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Box className="flex items-center">
            <StorageSizeInput
              label="When downloads total more than"
              value={config.autoRemovalUsageLimit}
              onChange={(value) => onConfigChange({ autoRemovalUsageLimit: value })}
              helperText="The oldest videos are deleted until the total is back under this size"
              testId="auto-removal-usage-limit"
            />
            <InfoTooltip
              text="Adds up the size of every video Youtarr has downloaded (video and MP3 files), using the sizes recorded at download time and refreshed by the nightly rescan. Unlike the low disk space rule, this works on network shares and cloud storage where free space is reported incorrectly. Thumbnails, subtitles and metadata files are not counted."
              onMobileClick={onMobileTooltipClick}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  </Grid>
);

export default AutoRemovalUsageControls;
