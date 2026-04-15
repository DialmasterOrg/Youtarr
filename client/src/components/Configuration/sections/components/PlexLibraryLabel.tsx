import React from 'react';
import { Box, Typography } from '../../../ui';
import { PlexLibraryDisplay } from '../../../../utils/plexLibraries';

type TypographyVariant = React.ComponentProps<typeof Typography>['variant'];
type TypographyColor = React.ComponentProps<typeof Typography>['color'];

interface PlexLibraryLabelProps {
  display: PlexLibraryDisplay;
  /**
   * When true, the primary text (title or id) renders with fontWeight 600.
   * Used by DefaultPlexLibraryDisplay; PlexSubfolderMappings uses the default.
   */
  boldPrimary?: boolean;
  primaryVariant?: TypographyVariant;
  secondaryVariant?: TypographyVariant;
  primaryColor?: TypographyColor;
  secondaryColor?: TypographyColor;
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
  primaryVariant = 'body2',
  secondaryVariant = 'body2',
  primaryColor,
  secondaryColor = 'text.secondary',
}) => {
  const primarySx = boldPrimary ? { fontWeight: 600 } : undefined;

  const renderContent = () => {
    switch (display.kind) {
      case 'resolved':
        return (
          <>
            <Typography variant={primaryVariant} color={primaryColor} sx={primarySx}>
              {display.title}
            </Typography>
            <Typography variant={secondaryVariant} color={secondaryColor}>
              (id: {display.id})
            </Typography>
          </>
        );
      case 'id-fallback':
        return (
          <Typography variant={primaryVariant} color={primaryColor} sx={primarySx}>
            Library ID: {display.id}
          </Typography>
        );
      case 'id-only':
        return (
          <Typography variant={primaryVariant} color={primaryColor} sx={primarySx}>
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
    <Box className="inline-flex flex-wrap items-baseline gap-1 md:flex-nowrap">
      {renderContent()}
    </Box>
  );
};
