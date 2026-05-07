import React, { useCallback, useEffect, useMemo, useState } from 'react';
import isEqual from 'lodash/isEqual';
import {
  Alert,
  Snackbar,
  Typography,
} from '../ui';
import { Info as InfoIcon } from '../../lib/icons';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PlexLibrarySelector from '../PlexLibrarySelector';
import PlexAuthDialog from '../PlexAuthDialog';
import ConfigurationSkeleton from '../Configuration/common/ConfigurationSkeleton';
import { CoreSettingsSection } from '../Configuration/sections/CoreSettingsSection';
import AppearanceSettingsSection from '../Configuration/sections/AppearanceSettingsSection';
import { PlexIntegrationSection } from '../Configuration/sections/PlexIntegrationSection';
import { SponsorBlockSection } from '../Configuration/sections/SponsorBlockSection';
import { CookieConfigSection } from '../Configuration/sections/CookieConfigSection';
import { NotificationsSection } from '../Configuration/sections/NotificationsSection';
import { DownloadPerformanceSection } from '../Configuration/sections/DownloadPerformanceSection';
import { YtdlpOptionsSection } from '../Configuration/sections/YtdlpOptionsSection';
import { AutoRemovalSection } from '../Configuration/sections/AutoRemovalSection';
import { AccountSecuritySection } from '../Configuration/sections/AccountSecuritySection';
import ApiKeysSection from '../Configuration/sections/ApiKeysSection';
import { YouTubeApiSection } from '../Configuration/sections/YouTubeApiSection';
import { SaveBar } from '../Configuration/sections/SaveBar';
import { UnsavedChangesDialog } from '../Configuration/sections/UnsavedChangesDialog';
import {
  usePlexConnection,
  useConfigSave,
  useYtDlpUpdate,
  useUnsavedChangesGuard,
} from '../Configuration/hooks';
import { useYouTubeApiKey } from '../Configuration/hooks/useYouTubeApiKey';
import { useStorageStatus } from '../../hooks/useStorageStatus';
import { useConfig } from '../../hooks/useConfig';
import { TRACKABLE_CONFIG_KEYS } from '../../config/configSchema';
import { ConfigState, SnackbarState } from '../Configuration/types';
import { validateConfig } from '../Configuration/utils/configValidation';
import { SETTINGS_PAGES, SettingsIndex } from './SettingsIndex';
import { MaintenanceSection } from './MaintenanceSection';

interface SettingsProps {
  token: string | null;
}

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
    plexLibraries,
    openPlexLibrarySelector,
    openPlexAuthDialog,
    setOpenPlexAuthDialog,
    checkPlexConnection,
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

  const { saveConfig, isSaving } = useConfigSave({
    token,
    config,
    setInitialConfig,
    setSnackbar,
    hasPlexServerConfigured,
    checkPlexConnection,
  });

  const {
    status: youtubeApiStatus,
    lastValidatedAt: youtubeApiLastValidatedAt,
    lastReason: youtubeApiLastReason,
    testKey: testYoutubeApiKey,
    clear: clearYoutubeApiStatus,
  } = useYouTubeApiKey({
    token,
    apiKey: config.youtubeApiKey,
    setInitialConfig,
    setSnackbar,
  });

  const shouldBlockNav = useCallback(
    (targetUrl: string) => !targetUrl.startsWith('/settings'),
    []
  );

  const { pendingNav, confirmNav, cancelNav } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    shouldBlock: shouldBlockNav,
  });

  const handleSaveAndContinue = useCallback(async () => {
    if (validationError) {
      setSnackbar({
        open: true,
        message: validationError,
        severity: 'error',
      });
      return;
    }
    const ok = await saveConfig();
    if (ok) {
      confirmNav();
    }
  }, [validationError, saveConfig, confirmNav]);

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

  const handleSave = () => {
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

  const handleConfigChange = (updates: Partial<ConfigState>) => {
    setConfig((prev) => ({ ...prev, ...updates }));

    const plexConnectionKeys: (keyof ConfigState)[] = ['plexIP', 'plexApiKey', 'plexPort', 'plexViaHttps'];
    if (plexConnectionKeys.some((key) => key in updates)) {
      setPlexConnectionStatus('not_tested');
    }

    if ('youtubeApiKey' in updates) {
      clearYoutubeApiStatus();
    }
  };

  useEffect(() => {
    if (!initialConfig) {
      setHasUnsavedChanges(false);
      return;
    }

    const changed = TRACKABLE_CONFIG_KEYS.some((k) => {
      return !isEqual(config[k], initialConfig[k]);
    });
    setHasUnsavedChanges(changed);
  }, [config, initialConfig]);

  const pageTitle = useMemo(() => {
    if (location.pathname === '/settings') return 'Settings';
    const suffix = location.pathname.replace('/settings/', '');
    const page = SETTINGS_PAGES.find((entry) => entry.key === suffix);
    return `Settings / ${page?.title || suffix}`;
  }, [location.pathname]);

  return (
    <div>
      <SaveBar
        hasUnsavedChanges={hasUnsavedChanges}
        isLoading={isLoading || isSaving}
        onSave={handleSave}
        validationError={validationError}
        placement="fixed"
      />

      <UnsavedChangesDialog
        open={pendingNav !== null}
        isSaving={isSaving}
        validationError={validationError ?? null}
        onDiscard={confirmNav}
        onCancel={cancelNav}
        onSave={handleSaveAndContinue}
      />

      <div style={{ marginBottom: 16 }}>
        <Typography variant="h5" style={{ fontWeight: 800 }}>
          {pageTitle}
        </Typography>
      </div>

      {isLoading ? (
        <ConfigurationSkeleton compact />
      ) : (
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
                ytDlpVersionInfo={ytDlpVersionInfo}
                ytDlpUpdateStatus={ytDlpUpdateStatus}
                onYtDlpUpdate={performYtDlpUpdate}
              />
            }
          />
          <Route path="appearance" element={<AppearanceSettingsSection onMobileTooltipClick={setMobileTooltip} />} />
          <Route
            path="plex"
            element={
              <PlexIntegrationSection
                config={config}
                isPlatformManaged={isPlatformManaged}
                plexConnectionStatus={plexConnectionStatus}
                plexLibraries={plexLibraries}
                hasPlexServerConfigured={hasPlexServerConfigured}
                onConfigChange={handleConfigChange}
                onTestConnection={testPlexConnection}
                onOpenLibrarySelector={openLibrarySelector}
                onOpenPlexAuthDialog={() => setOpenPlexAuthDialog(true)}
                onMobileTooltipClick={setMobileTooltip}
                token={token}
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
              <>
                <DownloadPerformanceSection
                  config={config}
                  onConfigChange={handleConfigChange}
                  onMobileTooltipClick={setMobileTooltip}
                />
                <YtdlpOptionsSection
                  config={config}
                  onConfigChange={handleConfigChange}
                  onMobileTooltipClick={setMobileTooltip}
                  token={token}
                />
              </>
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
          <Route
            path="youtube-api"
            element={
              <YouTubeApiSection
                config={config}
                status={youtubeApiStatus}
                lastValidatedAt={youtubeApiLastValidatedAt}
                lastReason={youtubeApiLastReason}
                onConfigChange={handleConfigChange}
                onTestKey={testYoutubeApiKey}
              />
            }
          />
          <Route
            path="maintenance"
            element={<MaintenanceSection token={token} />}
          />

          <Route path="*" element={<Navigate to="/settings" replace />} />
        </Routes>
      )}

      <PlexLibrarySelector
        open={openPlexLibrarySelector}
        handleClose={closeLibrarySelector}
        setLibraryId={setLibraryId}
        libraries={plexLibraries}
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
        onClose={() => setMobileTooltip(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setMobileTooltip(null)} severity="info" icon={<InfoIcon />}>
          {mobileTooltip}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default Settings;
