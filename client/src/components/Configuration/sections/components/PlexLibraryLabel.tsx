import React from 'react';
import { Box, Typography } from '../../../ui';
import { PlexLibraryDisplay } from '../../../../utils/plexLibraries';

interface PlexLibraryLabelProps {
  display: PlexLibraryDisplay;
  /**
   * When true, the primary text (title or id) renders with fontWeight 600.
   * Used by DefaultPlexLibraryDisplay; PlexSubfolderMappings uses the default.
   */
  boldPrimary?: boolean;
}

/**
 * Render a `PlexLibraryDisplay` discriminated union once. Both consumers
 * (DefaultPlexLibraryDisplay in PlexIntegrationSection and the mapping table
 * in PlexSubfolderMappings) use this. Adding a fourth display branch only
 * requires editing this file, not every consumer.
 */
export const PlexLibraryLabel: React.FC<PlexLibraryLabelProps> = ({
  display,
  boldPrimary = false,
}) => {
  const primarySx = boldPrimary ? { fontWeight: 600 } : undefined;

  const renderContent = () => {
    switch (display.kind) {
      case 'resolved':
        return (
          <>
            <Typography variant="body2" sx={primarySx}>
              {display.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              (id: {display.id})
            </Typography>
          </>
        );
      case 'id-fallback':
        return (
          <Typography variant="body2" sx={primarySx}>
            Library ID: {display.id}
          </Typography>
        );
      case 'id-only':
        return (
          <Typography variant="body2" sx={primarySx}>
            {display.id}
          </Typography>
        );
      default: {
        const _exhaustive: never = display;
        return _exhaustive;
      }
    }
  };

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.5, flexWrap: 'wrap' }}>
      {renderContent()}
    </Box>
  );
};
