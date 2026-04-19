import React from 'react';
import { Alert, Box, Typography } from '../../../ui';
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
 * Renders the default Plex library block below the Test Connection /
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
      <Box className="mt-4">
        <Typography variant="h6" color="text.secondary" className="mb-1.5">
          Default Plex Library
        </Typography>
        <Box className="flex flex-wrap items-center gap-2 md:flex-nowrap">
          <PlexLibraryLabel
            display={display}
            boldPrimary
            primaryVariant="subtitle1"
            secondaryVariant="body2"
          />
          <InfoTooltip
            text={DEFAULT_LIBRARY_TOOLTIP}
            onMobileClick={onMobileTooltipClick}
          />
        </Box>
        {plexConnectionStatus === 'not_connected' && (
          <Typography
            variant="caption"
            color="warning"
            className="mt-0.5 block"
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
      <Alert
        severity="warning"
        className="mt-4 w-full"
        data-testid="no-default-library-warning"
      >
        <Typography variant="body2" color="warning">
          No Default Plex Library Configured
        </Typography>
      </Alert>
    );
  }

  return null;
};
