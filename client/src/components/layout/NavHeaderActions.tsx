import React, { useMemo } from 'react';
import { Box, Typography, IconButton, Tooltip } from '../ui';
import { useNavigate } from 'react-router-dom';
import {
  LogOut as LogoutIcon,
  Download as DownloadIcon,
} from '../../lib/icons';
import { ThemeLayoutPolicy } from '../../themes';
import { StorageHeaderWidget } from './StorageHeaderWidget';

interface NavHeaderActionsProps {
  layoutPolicy: ThemeLayoutPolicy;
  token: string | null;
  isPlatformManaged: boolean;
  versionLabel?: string;
  updateAvailable: boolean;
  updateTooltip?: string;
  ytDlpUpdateAvailable?: boolean;
  ytDlpUpdateTooltip?: string;
  onLogout?: () => void;
  isMobile: boolean;
  showLandscapeNavItems: boolean;
  showTopNavItems: boolean;
}

export const NavHeaderActions: React.FC<NavHeaderActionsProps> = ({
  layoutPolicy,
  token,
  isPlatformManaged,
  versionLabel,
  updateAvailable,
  updateTooltip,
  ytDlpUpdateAvailable = false,
  ytDlpUpdateTooltip,
  onLogout,
  isMobile,
  showLandscapeNavItems,
  showTopNavItems,
}) => {
  const navigate = useNavigate();

  const hasAppUpdate = token && !isPlatformManaged && updateAvailable && Boolean(updateTooltip);
  const hasYtDlpUpdate = token && ytDlpUpdateAvailable && Boolean(ytDlpUpdateTooltip);
  const hasAnyUpdate = Boolean(hasAppUpdate || hasYtDlpUpdate);

  const sharedUpdateTooltip = useMemo(() => {
    const sections: string[] = [];

    if (hasAppUpdate && updateTooltip) {
      sections.push(`Youtarr: ${updateTooltip}`);
    }

    if (hasYtDlpUpdate && ytDlpUpdateTooltip) {
      sections.push(`yt-dlp: ${ytDlpUpdateTooltip}`);
    }

    return sections.join(' ');
  }, [hasAppUpdate, hasYtDlpUpdate, updateTooltip, ytDlpUpdateTooltip]);

  const sharedUpdateAriaLabel = hasAppUpdate && hasYtDlpUpdate
    ? 'Youtarr and yt-dlp updates available'
    : hasAppUpdate
      ? 'Youtarr update available'
      : 'yt-dlp update available';

  const sharedUpdateIndicatorStyle: React.CSSProperties = useMemo(() => {
    return {
      width: 'var(--header-update-indicator-width)',
      height: 'var(--header-update-indicator-height)',
      borderRadius: 'var(--header-update-indicator-radius)',
      color: 'var(--header-update-indicator-foreground)',
      backgroundColor: 'var(--header-update-indicator-background)',
      border: 'var(--header-update-indicator-border)',
      boxShadow: 'var(--header-update-indicator-shadow)',
    };
  }, []);

  const versionParts = useMemo(() => {
    if (!versionLabel) return [] as string[];
    return versionLabel.split('•').map((part) => part.trim()).filter(Boolean);
  }, [versionLabel]);

  return (
    <Box
      className="flex items-center"
      style={{ marginLeft: showTopNavItems && !showLandscapeNavItems ? 'auto' : 0, flexShrink: 0, minWidth: 0 }}
    >
      {layoutPolicy.headerVersionPlacement === 'desktop' && !isMobile && versionParts.length > 0 && (
        <Tooltip title="Click to view changelog" arrow placement="bottom">
          <Box
            className="flex flex-col items-end mr-3"
            style={{ lineHeight: 1.1, cursor: 'pointer' }}
            onClick={() => navigate('/changelog')}
          >
            <Typography variant="caption" style={{ color: 'var(--muted-foreground)', fontWeight: 600, fontSize: '0.6rem' }}>
              {versionParts[0]}
            </Typography>
            {versionParts[1] && (
              <Box className="flex items-center gap-1">
                <Typography variant="caption" style={{ color: 'var(--muted-foreground)', fontSize: '0.6rem' }}>
                  {versionParts[1]}
                </Typography>
              </Box>
            )}
          </Box>
        </Tooltip>
      )}

      {layoutPolicy.headerVersionPlacement === 'mobile' && isMobile && !showLandscapeNavItems && versionParts.length > 0 && (
        <Tooltip title="Tap to view changelog" arrow placement="bottom">
          <Typography
            variant="caption"
            onClick={() => navigate('/changelog')}
            style={{
              color: 'var(--muted-foreground)',
              fontWeight: 600,
              fontSize: '0.6rem',
              cursor: 'pointer',
              marginRight: 4,
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            {versionParts[0]}
          </Typography>
        </Tooltip>
      )}

      {hasAnyUpdate && sharedUpdateTooltip && (
        <Tooltip title={sharedUpdateTooltip} placement="bottom" arrow>
          <IconButton aria-label={sharedUpdateAriaLabel} className="mr-1" style={sharedUpdateIndicatorStyle}>
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      )}

      {token && layoutPolicy.showStorageHeaderWidget && <StorageHeaderWidget token={token} />}

      {token && !isPlatformManaged && onLogout && (
        <IconButton aria-label="logout" onClick={onLogout} style={{ color: 'var(--foreground)' }}>
          <LogoutIcon />
        </IconButton>
      )}
    </Box>
  );
};
