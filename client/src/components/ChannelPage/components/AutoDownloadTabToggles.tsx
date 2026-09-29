import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, Snackbar } from '../../ui';
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircleOutline as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
} from '../../../lib/icons';
import AutoDownloadChips from '../../Subscriptions/components/chips/AutoDownloadChips';
import { AutoDownloadToggleNotice, AutoDownloadToggleSeverity } from '../hooks/useAutoDownloadTabToggle';

const NOTICE_AUTO_HIDE_MS = 5000;
const ERROR_AUTO_HIDE_MS = 8000;
const NOTICE_ICON: Record<AutoDownloadToggleSeverity, { Icon: LucideIcon; color: string }> = {
  success: { Icon: CheckCircleIcon, color: 'text-success' },
  warning: { Icon: WarningIcon, color: 'text-warning' },
  error: { Icon: ErrorIcon, color: 'text-destructive' },
};
// Per-channel tabs only run while the global Automatic Downloads switch (Core settings) is on.
const GLOBAL_AUTO_DOWNLOAD_SETTINGS_PATH = '/settings/core';

// Display only: the save state comes from useAutoDownloadTabToggle in the page,
// which stays mounted while this unmounts for loading or a layout switch.
interface AutoDownloadTabTogglesProps {
  availableTabs: string;
  enabledTabs: string | undefined;
  isMobile: boolean;
  globalAutoDownloadOff: boolean;
  saving: boolean;
  notice: AutoDownloadToggleNotice | null;
  onToggle: (tab: string, enabled: boolean) => void;
  onUndo: () => void;
  onDismissNotice: () => void;
}

function AutoDownloadTabToggles({
  availableTabs,
  enabledTabs,
  isMobile,
  globalAutoDownloadOff,
  saving,
  notice,
  onToggle,
  onUndo,
  onDismissNotice,
}: AutoDownloadTabTogglesProps) {
  const { Icon: NoticeIcon, color: noticeIconColor } = NOTICE_ICON[notice?.severity ?? 'success'];

  return (
    <>
      <AutoDownloadChips
        availableTabs={availableTabs}
        autoDownloadTabs={enabledTabs}
        isMobile={isMobile}
        onToggle={onToggle}
        toggleDisabled={saving}
      />
      {/* Plain text on mobile: a link right under the toggles is too easy to tap by accident. */}
      {globalAutoDownloadOff && isMobile && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <WarningIcon size={12} className="text-warning shrink-0" />
          Automatic downloads are off in Settings
        </span>
      )}
      {globalAutoDownloadOff && !isMobile && (
        <RouterLink
          to={GLOBAL_AUTO_DOWNLOAD_SETTINGS_PATH}
          title="Enable Automatic Downloads in Core settings for these tabs to download on schedule"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          <WarningIcon size={12} className="text-warning shrink-0" />
          Automatic downloads are off
        </RouterLink>
      )}
      {/* Keyed by message so a follow-up toggle restarts the auto-hide timer. */}
      <Snackbar
        key={notice ? `${notice.severity}:${notice.message}` : 'none'}
        open={notice !== null}
        autoHideDuration={notice?.severity === 'error' ? ERROR_AUTO_HIDE_MS : NOTICE_AUTO_HIDE_MS}
        onClose={onDismissNotice}
      >
        {/* The snackbar surface overrides the alert's colors, so the icon carries the severity color. */}
        <Alert
          onClose={onDismissNotice}
          severity={notice?.severity ?? 'success'}
          icon={<NoticeIcon className={`h-5 w-5 shrink-0 ${noticeIconColor}`} />}
          className="items-center py-2"
          action={notice?.undoValue !== undefined ? (
            <Button size="small" variant="text" className="font-semibold" disabled={saving} onClick={onUndo}>
              Undo
            </Button>
          ) : undefined}
        >
          {notice?.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default AutoDownloadTabToggles;
