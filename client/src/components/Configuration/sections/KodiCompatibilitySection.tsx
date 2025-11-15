import React, { ChangeEvent } from 'react';
import {
  FormControl,
  FormControlLabel,
  Switch,
  FormHelperText,
  Grid,
  Box,
  Alert,
  Typography,
} from '@mui/material';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { InfoTooltip } from '../common/InfoTooltip';
import { ConfigState } from '../types';

interface KodiCompatibilitySectionProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
}

export const KodiCompatibilitySection: React.FC<KodiCompatibilitySectionProps> = ({
  config,
  onConfigChange,
  onMobileTooltipClick,
}) => {
  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    onConfigChange({ [event.target.name]: event.target.checked });
  };

  return (
    <ConfigurationAccordion
      title="Kodi, Emby and Jellyfin compatibility"
      defaultExpanded={false}
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Control generation of metadata and artwork files that help Kodi, Emby and Jellyfin index your downloads cleanly.
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
          For best results:
        </Typography>
        <Typography variant="body2" component="div">
          • Add your download library as Content Type: <strong>Movies</strong>
          <br />
          • Under Metadata Readers/Savers, select <strong>Nfo</strong> to read the .nfo files
          <br />
          • Uncheck all metadata downloaders since we provide metadata via .nfo files
        </Typography>
      </Alert>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControl component="fieldset" variant="standard">
            <FormControlLabel
              control={
                <Switch
                  name="writeVideoNfoFiles"
                  checked={config.writeVideoNfoFiles}
                  onChange={handleCheckboxChange}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  Generate video .nfo files
                  <InfoTooltip
                    text="Create .nfo metadata alongside each download so Kodi, Emby and Jellyfin can import videos with full details."
                    onMobileClick={onMobileTooltipClick}
                  />
                </Box>
              }
            />
            <FormHelperText>
              Recommended when another media server scans your downloads.
            </FormHelperText>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl component="fieldset" variant="standard">
            <FormControlLabel
              control={
                <Switch
                  name="writeChannelPosters"
                  checked={config.writeChannelPosters}
                  onChange={handleCheckboxChange}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  Copy channel poster.jpg files
                  <InfoTooltip
                    text="Copy channel thumbnails into each channel folder as poster.jpg for media server compatibility."
                    onMobileClick={onMobileTooltipClick}
                  />
                </Box>
              }
            />
            <FormHelperText>
              Helps Kodi, Emby and Jellyfin display artwork for channel folders.
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
    </ConfigurationAccordion>
  );
};
