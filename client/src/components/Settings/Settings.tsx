import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogActions,
  Button,
  Alert,
  Snackbar,
  Box,
  Typography,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PlexLibrarySelector from '../PlexLibrarySelector';
import PlexAuthDialog from '../PlexAuthDialog';
import ConfigurationSkeleton from '../Configuration/common/ConfigurationSkeleton';
import { CoreSettingsSection } from '../Configuration/sections/CoreSettingsSection';
import AppearanceSettingsSection from '../Configuration/sections/AppearanceSettingsSection';
import { PlexIntegrationSection } from '../Configuration/sections/PlexIntegrationSection';
import { SponsorBlockSection } from '../Configuration/sections/SponsorBlockSection';
import { KodiCompatibilitySection } from '../Configuration/sections/KodiCompatibilitySection';
import { CookieConfigSection } from '../Configuration/sections/CookieConfigSection';
import { NotificationsSection } from '../Configuration/sections/NotificationsSection';
import { DownloadingSection } from '../Configuration/sections/DownloadingSection';
import { AutoRemovalSection } from '../Configuration/sections/AutoRemovalSection';
import { AccountSecuritySection } from '../Configuration/sections/AccountSecuritySection';
import ApiKeysSection from '../Configuration/sections/ApiKeysSection';
import { TopSaveBar } from '../Configuration/sections/TopSaveBar';
import { usePlexConnection, useConfigSave, useYtDlpUpdate } from '../Configuration/hooks';
import { useStorageStatus } from '../../hooks/useStorageStatus';
import { useConfig } from '../../hooks/useConfig';
import { TRACKABLE_CONFIG_KEYS } from '../../config/configSchema';
import { ConfigState, SnackbarState } from '../Configuration/types';
import { validateConfig } from '../Configuration/utils/configValidation';
import { SettingsIndex } from './SettingsIndex';

interface SettingsProps {
  token: string | null;
}

const isDeepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => isDeepEqual(value, b[index]));
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && isDeepEqual(a[key], b[key]));
};

export function Settings({ token }: SettingsProps) {
  const location = useLocation();

  const {
    config,
    initialConfig,
    isPlatformManaged,
    deploymentEnvironment,
    loading: isLoading,
    setConfig,
    setInitialConfig,
  } = useConfig(token);

  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);

  const hasPlexServerConfigured = isPlatformManaged.plexUrl || Boolean(config.plexIP);

  const { available: storageAvailable } = useStorageStatus(token, { checkOnly: true });

  const validationError = validateConfig(config);

  const {
    plexConnectionStatus,
    setPlexConnectionStatus,
    openPlexLibrarySelector,
    openPlexAuthDialog,
    setOpenPlexAuthDialog,
    testPlexConnection,
    openLibrarySelector,
    closeLibrarySelector,
    setLibraryId,
    handlePlexAuthSuccess,
  } = usePlexConnection({
    token,
    config,
    setConfig,
    setInitialConfig,
    setSnackbar,
    hasPlexServerConfigured,
  });

  const { saveConfig } = useConfigSave({
    token,
    config,
    setInitialConfig,
    setSnackbar,
    hasPlexServerConfigured,
    checkPlexConnection: () => {},
  });

  const {
    versionInfo: ytDlpVersionInfo,
    updateStatus: ytDlpUpdateStatus,
    errorMessage: ytDlpErrorMessage,
    successMessage: ytDlpSuccessMessage,
    performUpdate: performYtDlpUpdate,
    clearMessages: clearYtDlpMessages,
  } = useYtDlpUpdate(token);

  useEffect(() => {
    if (ytDlpErrorMessage) {
      setSnackbar({
        open: true,
        message: ytDlpErrorMessage,
        severity: 'error',
      });
      clearYtDlpMessages();
    } else if (ytDlpSuccessMessage) {
      setSnackbar({
        open: true,
        message: ytDlpSuccessMessage,
        severity: 'success',
      });
      clearYtDlpMessages();
    }
  }, [ytDlpErrorMessage, ytDlpSuccessMessage, clearYtDlpMessages]);

  const handleConfirmSave = () => {
    setOpenConfirmDialog(false);

    if (validationError) {
      setSnackbar({
        open: true,
        message: validationError,
        severity: 'error',
      });
      return;
    }

    saveConfig();
  };

  const handleSave = () => {
    if (validationError) {
      setSnackbar({
        open: true,
        message: validationError,
        severity: 'error',
      });
      return;
    }
    setOpenConfirmDialog(true);
  };

  const handleConfigChange = (updates: Partial<ConfigState>) => {
    setConfig((prev) => ({ ...prev, ...updates }));

    const plexConnectionKeys: (keyof ConfigState)[] = ['plexIP', 'plexApiKey', 'plexPort', 'plexViaHttps'];
    if (plexConnectionKeys.some((key) => key in updates)) {
      setPlexConnectionStatus('not_tested');
    }
  };

  useEffect(() => {
    if (!initialConfig) {
      setHasUnsavedChanges(false);
      return;
    }

    const changed = TRACKABLE_CONFIG_KEYS.some((k) => {
      return !isDeepEqual((config as any)[k], (initialConfig as any)[k]);
    });
    setHasUnsavedChanges(changed);
  }, [config, initialConfig]);

  const pageTitle = useMemo(() => {
    if (location.pathname === '/settings') return 'Settings';
    const suffix = location.pathname.replace('/settings/', '');
    return `Settings / ${suffix}`;
  }, [location.pathname]);

  if (isLoading) {
    return <ConfigurationSkeleton />;
  }

  return (
    <Box>
      <TopSaveBar
        hasUnsavedChanges={hasUnsavedChanges}
        isLoading={isLoading}
        onSave={handleSave}
        validationError={validationError}
      />

      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {pageTitle}
        </Typography>
      </Box>

      <Routes>
        <Route index element={<SettingsIndex />} />
        <Route
          path="core"
          element={
            <CoreSettingsSection
              config={config}
              deploymentEnvironment={deploymentEnvironment}
              isPlatformManaged={isPlatformManaged}
              onConfigChange={handleConfigChange}
              onMobileTooltipClick={setMobileTooltip}
              token={token}
            />
          }
        />
        <Route path="appearance" element={<AppearanceSettingsSection />} />
        <Route
          path="plex"
          element={
            <PlexIntegrationSection
              config={config}
              isPlatformManaged={isPlatformManaged}
              plexConnectionStatus={plexConnectionStatus}
              hasPlexServerConfigured={hasPlexServerConfigured}
              onConfigChange={handleConfigChange}
              onTestConnection={testPlexConnection}
              onOpenLibrarySelector={openLibrarySelector}
              onOpenPlexAuthDialog={() => setOpenPlexAuthDialog(true)}
              onMobileTooltipClick={setMobileTooltip}
            />
          }
        />
        <Route
          path="sponsorblock"
          element={
            <SponsorBlockSection
              config={config}
              onConfigChange={handleConfigChange}
              onMobileTooltipClick={setMobileTooltip}
            />
          }
        />
        <Route
          path="kodi"
          element={
            <KodiCompatibilitySection
              config={config}
              onConfigChange={handleConfigChange}
              onMobileTooltipClick={setMobileTooltip}
            />
          }
        />
        <Route
          path="cookies"
          element={
            <CookieConfigSection
              token={token}
              config={config}
              setConfig={setConfig}
              onConfigChange={handleConfigChange}
              setSnackbar={setSnackbar}
              onMobileTooltipClick={setMobileTooltip}
            />
          }
        />
        <Route
          path="notifications"
          element={
            <NotificationsSection
              token={token}
              config={config}
              onConfigChange={handleConfigChange}
              onMobileTooltipClick={setMobileTooltip}
              setSnackbar={setSnackbar}
            />
          }
        />
        <Route
          path="downloading"
          element={
            <DownloadingSection
              config={config}
              onConfigChange={handleConfigChange}
              onMobileTooltipClick={setMobileTooltip}
              ytDlpVersionInfo={ytDlpVersionInfo}
              ytDlpUpdateStatus={ytDlpUpdateStatus}
              onYtDlpUpdate={performYtDlpUpdate}
            />
          }
        />
        <Route path="performance" element={<Navigate to="/settings/downloading" replace />} />
        <Route path="advanced" element={<Navigate to="/settings/downloading" replace />} />
        <Route
          path="autoremove"
          element={
            <AutoRemovalSection
              token={token}
              config={config}
              storageAvailable={storageAvailable}
              onConfigChange={handleConfigChange}
              onMobileTooltipClick={setMobileTooltip}
            />
          }
        />
        <Route
          path="security"
          element={
            <AccountSecuritySection
              token={token}
              envAuthApplied={config.envAuthApplied}
              authEnabled={isPlatformManaged.authEnabled}
              setSnackbar={setSnackbar}
            />
          }
        />
        <Route
          path="api-keys"
          element={
            <ApiKeysSection
              token={token}
              apiKeyRateLimit={config.apiKeyRateLimit}
              onRateLimitChange={(value) => handleConfigChange({ apiKeyRateLimit: value })}
            />
          }
        />

        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>

      <Dialog open={openConfirmDialog} onClose={() => setOpenConfirmDialog(false)}>
        <DialogTitle>Save configuration changes?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setOpenConfirmDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmSave} autoFocus>
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>

      <PlexLibrarySelector
        open={openPlexLibrarySelector}
        handleClose={closeLibrarySelector}
        setLibraryId={setLibraryId}
        token={token}
      />

      <PlexAuthDialog
        open={openPlexAuthDialog}
        onClose={() => setOpenPlexAuthDialog(false)}
        onSuccess={handlePlexAuthSuccess}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Snackbar
        open={mobileTooltip !== null}
        autoHideDuration={8000}
        onClose={() => setMobileTooltip(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setMobileTooltip(null)} severity="info" icon={<InfoIcon />}>
          {mobileTooltip}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Settings;
