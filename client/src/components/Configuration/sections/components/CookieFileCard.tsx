import React from 'react';
import { Alert, AlertTitle, Box, Button, Chip, Typography } from '../../../ui';
import { useCookieTest } from '../../hooks/useCookieTest';
import { CookieStatus, CookieTestResult } from '../../types';
import { formatDateTime } from '../../../../utils/formatters';
import { CookieDetailsWarning, CookieFact, CookieFactList, getLoginCookieFacts } from './CookieFileFacts';
import { ExternalCookieNotes } from './ExternalCookieNotes';

interface CookieFileCardProps {
  token: string | null;
  cookieStatus: CookieStatus;
  /** The Enable Cookies toggle, including unsaved changes. */
  cookiesEnabled: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => void;
  onRefresh: () => void;
}

type HealthColor = 'default' | 'success' | 'warning' | 'error';

// A test result is ground truth; the file's own dates are only a hint.
function getHealth(status: CookieStatus, result: CookieTestResult | null): { label: string; color: HealthColor } {
  const details = status.details;
  if (status.external && !status.external.ready) return { label: 'Unavailable', color: 'error' };
  if (result && !result.ok) return { label: 'Test failed', color: 'error' };
  if (result?.ok) return { label: 'Signed in', color: 'success' };
  if (details?.loginCookiesFound === 0) return { label: 'No login cookies', color: 'warning' };
  if (details && details.expiredLoginCookies > 0) return { label: 'Expired', color: 'warning' };
  if (details) return { label: 'Not tested', color: 'default' };
  if (!status.external && !status.customFileExists) return { label: 'No file', color: 'default' };
  return { label: 'Inactive', color: 'default' };
}

function describeLastTest(testing: boolean, result: CookieTestResult | null, testedAt: Date | null): React.ReactNode {
  if (testing) return 'Testing...';
  if (!result) return <span className="text-muted-foreground">Not tested</span>;
  const when = testedAt ? `, ${formatDateTime(testedAt.toISOString())}` : '';
  return result.ok
    ? <span className="text-success">Signed in{when}</span>
    : <span className="text-destructive">Failed{when}</span>;
}

export const CookieFileCard: React.FC<CookieFileCardProps> = ({
  token, cookieStatus, cookiesEnabled, uploading, onUpload, onDelete, onRefresh,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const { result, testing, testedAt, runTest } = useCookieTest(token);
  const { external } = cookieStatus;
  const details = cookieStatus.details ?? null;
  const hasFile = Boolean(external) || cookieStatus.customFileExists;
  const health = getHealth(cookieStatus, result);
  let testDisabledReason: string | null = null;
  if (!cookieStatus.cookiesEnabled) testDisabledReason = 'Save your settings with cookies enabled to test them.';
  else if (!details) testDisabledReason = 'No usable cookie file is active.';

  const modified = external ? external.lastModified : details?.lastModified;
  const facts: CookieFact[] = [
    { label: 'Source', value: external ? <code className="break-all">{external.path}</code> : 'Uploaded file' },
    ...(details ? getLoginCookieFacts(details) : []),
    ...(modified ? [{ label: external ? 'Modified' : 'Uploaded', value: formatDateTime(modified) }] : []),
    { label: 'Last test', value: describeLastTest(testing, result, testedAt) },
  ];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await onUpload(file);
    event.target.value = '';
  };
  const actionClass = 'w-full sm:w-auto';
  let uploadLabel = hasFile ? 'Replace file' : 'Upload cookie file';
  if (uploading) uploadLabel = 'Uploading...';

  return (
    <Box className="space-y-4 rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-card/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Typography variant="subtitle1">Cookie file</Typography>
        <Chip label={health.label} color={health.color} size="small" className="self-start sm:self-auto" />
      </div>

      {hasFile ? <CookieFactList facts={facts} /> : (
        <>
          <Typography variant="body2">No cookie file uploaded yet.</Typography>
          <Alert severity="warning">
            <AlertTitle>Use a throwaway account</AlertTitle>
            <Typography variant="body2">
              A cookie file grants access to the Google account it came from. Export cookies from a
              throwaway account, not your main one.
            </Typography>
          </Alert>
        </>
      )}

      {external && <ExternalCookieNotes external={external} cookiesEnabled={cookiesEnabled} />}
      {details && <CookieDetailsWarning details={details} />}
      {result && !result.ok && (
        <Alert severity="error">
          <Typography variant="body2">{result.error}</Typography>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {hasFile && (
          <Button
            variant="contained"
            className={actionClass}
            disabled={Boolean(testDisabledReason) || testing}
            onClick={() => { void runTest(); }}
          >
            {testing ? 'Testing...' : 'Test cookies'}
          </Button>
        )}
        {external ? (
          <Button variant="outlined" className={actionClass} onClick={onRefresh}>
            Refresh file status
          </Button>
        ) : (
          <Button
            variant={hasFile ? 'outlined' : 'contained'}
            className={actionClass}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadLabel}
          </Button>
        )}
        {!external && cookieStatus.customFileExists && (
          <Button variant="text" color="error" className={`${actionClass} sm:ml-auto`} onClick={onDelete}>
            Delete file
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".txt,text/plain"
          data-testid="cookie-file-input"
          onChange={handleFileChange}
        />
      </div>

      {hasFile && testDisabledReason && (
        <Typography variant="caption" className="block text-muted-foreground">{testDisabledReason}</Typography>
      )}
      <Typography variant="caption" className="block text-muted-foreground">
        {hasFile
          ? 'A cookie file grants access to the Google account it came from; use a throwaway account.'
          : 'Netscape format cookie file exported from your browser, up to 1 MB.'}
      </Typography>
    </Box>
  );
};
