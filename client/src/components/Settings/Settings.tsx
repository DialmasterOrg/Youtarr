import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import JellyfinSection from '../Configuration/sections/JellyfinSection';
import EmbySection from '../Configuration/sections/EmbySection';
import WatchStatusSection from '../Configuration/sections/WatchStatusSection';
import { SponsorBlockSection } from '../Configuration/sections/SponsorBlockSection';
import { CookieConfigSection } from '../Configuration/sections/CookieConfigSection';
import { NotificationsSection } from '../Configuration/sections/NotificationsSection';
import { DownloadPerformanceSection } from '../Configuration/sections/DownloadPerformanceSection';
import { YtdlpOptionsSection } from '../Configuration/sections/YtdlpOptionsSection';
import { YtdlpUpdateSection } from '../Configuration/sections/YtdlpUpdateSection';
import { AutoRemovalSection } from '../Configuration/sections/AutoRemovalSection';
import { StorageLimitsSection } from '../Configuration/sections/StorageLimitsSection';
import { AccountSecuritySection } from '../Configuration/sections/AccountSecuritySection';
import ApiKeysSection from '../Configuration/sections/ApiKeysSection';
import { YouTubeApiSection } from '../Configuration/sections/YouTubeApiSection';
import { SaveBar } from '../Configuration/sections/SaveBar';
import { UnsavedChangesDialog } from '../Configuration/sections/UnsavedChangesDialog';
import { YtdlpChannelApplyDialog } from '../Configuration/sections/components/YtdlpChannelApplyDialog';
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
import { defaultSubfolderMoveNotice } from './defaultSubfolderMove';
import { ConfigState, SnackbarState } from '../Configuration/types';
import { validateConfig } from '../Configuration/utils/configValidation';
import { FILENAME_PRESETS } from '../../utils/filenameTemplate/presets';
import { validatePrefix } from '../../utils/filenameTemplate/validate';
import { SettingsIndex } from './SettingsIndex';
import { settingsHeading } from './settingsHeading';
import LibraryFolders from '../LibraryFolders';
import { MaintenanceSection } from './MaintenanceSection';
import { SchedulingSection } from '../Configuration/sections/SchedulingSection';
import { LoggingSection } from '../Configuration/sections/LoggingSection';
import { ReorganizeDialog, useReorganizeOutcome } from '../shared/Reorganize';
import { ReorganizeStartResult } from '../../types/reorganize';

interface SettingsProps {
  token: string | null;
}

const PREVIEW_CUSTOM_TEMPLATE_MESSAGE = 'Preview this custom filename template before saving.';

const normalizeFilenamePrefix = (prefix?: string | null) => (prefix ?? '').replace(/\s+$/, '');

export function Settings({ token }: SettingsProps) {
  const location = useLocation();

  const {
    config,
    initialConfig,
    isPlatformManaged,
    deploymentEnvironment,
    loggingStatus,
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
  const [filenamePreviewedPrefix, setFilenamePreviewedPrefix] = useState<string | null>(null);
  const [channelApplyTarget, setChannelApplyTarget] = useState<'stable' | 'nightly' | null>(null);

  const hasPlexServerConfigured = isPlatformManaged.plexUrl || Boolean(config.plexIP);

  const { available: storageAvailable } = useStorageStatus(token, { checkOnly: true });

  const configValidationError = validateConfig(config);
  const filenameTemplateSaveRequirement = useMemo(() => {
    if (!initialConfig) return null;

    const currentPrefix = normalizeFilenamePrefix(config.videoFilenamePrefix);
    if (!validatePrefix(currentPrefix).ok) return null;

    const savedPrefix = normalizeFilenamePrefix(initialConfig.videoFilenamePrefix);
    if (currentPrefix === savedPrefix) return null;

    const matchesPreset = FILENAME_PRESETS.some(
      (preset) => normalizeFilenamePrefix(preset.prefix) === currentPrefix
    );
    if (matchesPreset) return null;

    if (filenamePreviewedPrefix === currentPrefix) return null;

    return PREVIEW_CUSTOM_TEMPLATE_MESSAGE;
  }, [config.videoFilenamePrefix, initialConfig, filenamePreviewedPrefix]);
  const validationError = configValidationError ?? filenameTemplateSaveRequirement;

  const handleFilenameTemplatePreviewSuccess = useCallback((prefix: string) => {
    setFilenamePreviewedPrefix(normalizeFilenamePrefix(prefix));
  }, []);

  const {
    plexConnectionStatus,
    setPlexConnectionStatus,
    plexServerClaimed,
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

  const {
    saveConfig, isSaving, fieldErrors, clearFieldErrors, reorganizeChange, finishReorganize, readBackDefaultSubfolder,
  } = useConfigSave({
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

  // The move started or retried from here, followed to each end (the review may be closed by then).
  const [trackedMove, setTrackedMove] = useState<{ operationId: number; requested: string; attempt: number } | null>(null);
  // The default subfolder value this flow last put in the form: the requested
  // one at the start, the read-back one after an end. The form is moved on
  // only while it still holds that value, so an edit made meanwhile is kept.
  const formDefaultSetByMove = useRef<string | null>(null);

  // A default subfolder change that moved downloads is applied by the
  // reorganize; the rest of the form is saved by saving again.
  const handleDefaultSubfolderMoved = useCallback((result: ReorganizeStartResult) => {
    if (!reorganizeChange || reorganizeChange.type !== 'defaultSubfolder') return;
    const value = reorganizeChange.value;
    const notice = initialConfig ? defaultSubfolderMoveNotice(config, initialConfig, value) : null;
    setInitialConfig((current) => (current ? { ...current, defaultSubfolder: value } : current));
    formDefaultSetByMove.current = value;
    if (result.operationId) setTrackedMove({ operationId: result.operationId, requested: value, attempt: 0 });
    if (notice) setSnackbar({ open: true, message: notice, severity: 'info' });
  }, [reorganizeChange, setInitialConfig, config, initialConfig]);

  // The server undoes the change when no video could be moved, and applies
  // it again when a retry moves some: the form follows the value read back,
  // unless the user has edited the field again meanwhile.
  const followReadBack = useCallback((requested: string, saved: string | null) => {
    const shown = formDefaultSetByMove.current;
    if (saved === null || shown === null || saved === shown) return;
    setConfig((current) => (current.defaultSubfolder === shown ? { ...current, defaultSubfolder: saved } : current));
    formDefaultSetByMove.current = saved;
    setSnackbar({
      open: true,
      message: saved === requested
        ? 'The retry moved the videos, so the default subfolder change is applied after all.'
        : 'The default subfolder change was undone because none of the videos could be moved.',
      severity: saved === requested ? 'info' : 'warning',
    });
  }, [setConfig]);

  const handleReorganizeClosed = useCallback(async () => {
    const requested = reorganizeChange?.type === 'defaultSubfolder' ? reorganizeChange.value : null;
    const saved = await finishReorganize();
    if (requested !== null) followReadBack(requested, saved);
  }, [reorganizeChange, finishReorganize, followReadBack]);

  const handleReorganizeRetried = useCallback((operationId: number) => {
    setTrackedMove((current) => (current && current.operationId === operationId
      ? { ...current, attempt: current.attempt + 1 }
      : current));
  }, []);

  useReorganizeOutcome(token, trackedMove?.operationId ?? null, () => {
    const requested = trackedMove?.requested;
    if (requested === undefined) return;
    void readBackDefaultSubfolder().then((saved) => followReadBack(requested, saved));
  }, { attempt: trackedMove?.attempt ?? 0 });

  const {
    versionInfo: ytDlpVersionInfo,
    updateStatus: ytDlpUpdateStatus,
    errorMessage: ytDlpErrorMessage,
    successMessage: ytDlpSuccessMessage,
    performUpdate: performYtDlpUpdate,
    clearMessages: clearYtDlpMessages,
    checkLatestVersion: checkYtDlpLatestVersion,
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

  const handleSave = async () => {
    if (validationError) {
      setSnackbar({
        open: true,
        message: validationError,
        severity: 'error',
      });
      return;
    }
    const previousChannel = initialConfig?.ytdlpUpdateChannel;
    const ok = await saveConfig();
    if (
      ok &&
      !isPlatformManaged.ytdlpUpdates &&
      previousChannel !== undefined &&
      previousChannel !== config.ytdlpUpdateChannel
    ) {
      setChannelApplyTarget(config.ytdlpUpdateChannel === 'nightly' ? 'nightly' : 'stable');
      checkYtDlpLatestVersion();
    }
  };

  const handleConfigChange = (updates: Partial<ConfigState>) => {
    clearFieldErrors(updates);
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

  const pageTitle = useMemo(() => settingsHeading(location.pathname), [location.pathname]);

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

      <YtdlpChannelApplyDialog
        targetChannel={channelApplyTarget}
        onApply={performYtDlpUpdate}
        onClose={() => setChannelApplyTarget(null)}
      />

      {pageTitle !== null && (
        <div style={{ marginBottom: 16 }}>
          <Typography variant="h5" style={{ fontWeight: 800 }}>
            {pageTitle}
          </Typography>
        </div>
      )}

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
                filenameTemplateSaveRequirement={filenameTemplateSaveRequirement}
                onFilenameTemplatePreviewSuccess={handleFilenameTemplatePreviewSuccess}
              />
            }
          />
          <Route
            path="library/*"
            element={
              <LibraryFolders
                token={token}
                config={config}
                isPlatformManaged={isPlatformManaged}
                deploymentEnvironment={deploymentEnvironment}
                plexLibraries={plexLibraries}
                plexConnectionStatus={plexConnectionStatus}
                setSnackbar={setSnackbar}
              />
            }
          />
          <Route
            path="scheduling"
            element={<SchedulingSection
              config={config}
              savedConfig={initialConfig}
              deploymentEnvironment={deploymentEnvironment}
              isPlatformManaged={isPlatformManaged}
              onConfigChange={handleConfigChange}
              fieldErrors={fieldErrors}
              token={token}
            />}
          />
          <Route path="appearance" element={<AppearanceSettingsSection onMobileTooltipClick={setMobileTooltip} />} />
          <Route
            path="plex"
            element={
              <PlexIntegrationSection
                config={config}
                isPlatformManaged={isPlatformManaged}
                plexConnectionStatus={plexConnectionStatus}
                plexServerClaimed={plexServerClaimed}
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
            path="jellyfin"
            element={
              <JellyfinSection
                config={config}
                token={token}
                onConfigChange={handleConfigChange}
              />
            }
          />
          <Route
            path="emby"
            element={
              <EmbySection
                config={config}
                token={token}
                onConfigChange={handleConfigChange}
              />
            }
          />
          <Route
            path="watch-status"
            element={
              <WatchStatusSection
                config={config}
                token={token}
                onConfigChange={handleConfigChange}
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
                <YtdlpUpdateSection
                  config={config}
                  deploymentEnvironment={deploymentEnvironment}
                  isPlatformManaged={isPlatformManaged}
                  onConfigChange={handleConfigChange}
                  onMobileTooltipClick={setMobileTooltip}
                  ytDlpVersionInfo={ytDlpVersionInfo}
                  ytDlpUpdateStatus={ytDlpUpdateStatus}
                  onYtDlpUpdate={performYtDlpUpdate}
                />
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
            path="storage-limits"
            element={
              <StorageLimitsSection
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
            element={<MaintenanceSection token={token} config={config} />}
          />
          <Route
            path="logging"
            element={
              <LoggingSection
                config={config}
                savedLogLevel={initialConfig?.logLevel ?? ''}
                loggingStatus={loggingStatus}
                token={token}
                onConfigChange={handleConfigChange}
              />
            }
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

      <ReorganizeDialog
        open={reorganizeChange !== null}
        token={token}
        change={reorganizeChange}
        onClose={() => { void handleReorganizeClosed(); }}
        onApplied={handleDefaultSubfolderMoved}
        onRetried={handleReorganizeRetried}
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
