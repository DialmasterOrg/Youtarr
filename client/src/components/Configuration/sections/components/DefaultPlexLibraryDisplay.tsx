import React from 'react';
import { Box, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { InfoTooltip } from '../../common/InfoTooltip';
import { PlexConnectionStatus } from '../../types';
import {
  PlexLibrary,
  resolveLibraryDisplay,
} from '../../../../utils/plexLibraries';
import { PlexLibraryLabel } from './PlexLibraryLabel';

const DEFAULT_LIBRARY_TOOLTIP =
  'Youtarr refreshes this library after downloads to the root folder, or to any subfolder that does not have its own mapping below.';

interface DefaultPlexLibraryDisplayProps {
  libraries: PlexLibrary[];
  libraryId: string | undefined;
  plexConnectionStatus: PlexConnectionStatus;
  hasPlexServerConfigured: boolean;
  hasPlexApiKey: boolean;
  onMobileTooltipClick?: (text: string) => void;
}

/**
 * Renders the "Default Plex Library: ..." line below the Test Connection /
 * Select Default Library buttons in PlexIntegrationSection.
 *
 * Three states:
 *   1. libraryId set and connected   -> show resolved title + id
 *   2. libraryId set but unreachable -> show id fallback + warning caption
 *   3. libraryId unset but Plex is configured -> "No Default Plex Library Configured"
 *   4. libraryId unset and Plex not configured -> render nothing
 */
export const DefaultPlexLibraryDisplay: React.FC<DefaultPlexLibraryDisplayProps> = ({
  libraries,
  libraryId,
  plexConnectionStatus,
  hasPlexServerConfigured,
  hasPlexApiKey,
  onMobileTooltipClick,
}) => {
  if (libraryId) {
    const display = resolveLibraryDisplay(libraries, libraryId);
    return (
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Default Plex Library:
          </Typography>
          <PlexLibraryLabel display={display} boldPrimary />
          <InfoTooltip
            text={DEFAULT_LIBRARY_TOOLTIP}
            onMobileClick={onMobileTooltipClick}
          />
        </Box>
        {plexConnectionStatus === 'not_connected' && (
          <Typography
            variant="caption"
            color="warning.main"
            sx={{ display: 'block', mt: 0.25 }}
            data-testid="default-library-unreachable-warning"
          >
            Cannot reach Plex; showing saved library ID.
          </Typography>
        )}
      </Box>
    );
  }

  if (hasPlexServerConfigured && hasPlexApiKey) {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}
        data-testid="no-default-library-warning"
      >
        <WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />
        <Typography variant="body2" color="warning.main">
          No Default Plex Library Configured
        </Typography>
      </Box>
    );
  }

  return null;
};
