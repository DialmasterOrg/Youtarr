import React from 'react';
import {
  Grid,
  Alert,
  AlertTitle,
  Typography,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '../../ui';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { useCookieManagement } from '../hooks/useCookieManagement';
import { ConfigState, SnackbarState } from '../types';

interface CookieConfigSectionProps {
  token: string | null;
  config: ConfigState;
  setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
  onMobileTooltipClick?: (text: string) => void;
}

export const CookieConfigSection: React.FC<CookieConfigSectionProps> = ({
  token,
  config,
  setConfig,
  onConfigChange,
  setSnackbar,
  onMobileTooltipClick,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const {
    cookieStatus,
    refreshCookieStatus,
    uploadingCookie,
    uploadCookieFile,
    deleteCookies,
  } = useCookieManagement({ token, setConfig, setSnackbar });
  const externalCookies = cookieStatus?.external;
  const externalIssue = config.cookiesEnabled && externalCookies && (!externalCookies.ready || externalCookies.warning);

  const handleCookieUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadCookieFile(file);
    event.target.value = '';
  };
  return (
    <ConfigurationAccordion
      title="Cookie Configuration"
      chipLabel={externalIssue ? 'External cookie warning' : config.cookiesEnabled ? 'Cookies Enabled' : 'Cookies Disabled'}
      chipColor={externalIssue ? 'warning' : config.cookiesEnabled ? 'success' : 'default'}
      statusBanner={{
        enabled: config.cookiesEnabled,
        label: 'Enable Cookies',
        onToggle: (enabled) => onConfigChange({ cookiesEnabled: enabled }),
        onText: externalCookies && !externalCookies.ready ? 'Cookies enabled; external file unavailable' : 'Cookies Enabled',
        offText: 'Cookies Disabled',
        successWhenEnabled: !externalIssue,
      }}
      defaultExpanded={false}
    >
      <Alert severity="warning" style={{ marginBottom: 16 }}>
        <AlertTitle>Security Warning</AlertTitle>
        <Typography variant="body2" style={{ marginBottom: 16 }}>
          Cookie files contain authentication information for your Google account.
          We recommend using a throwaway account for standard downloads. If you wish to download members-only content, the cookies must belong to the account holding the active channel membership.
        </Typography>
        <Typography variant="body2">
          Learn more about cookie security:{' '}
          <a href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
             target="_blank"
             rel="noopener noreferrer"
             style={{ color: 'inherit', textDecoration: 'underline' }}>
            yt-dlp Cookie FAQ
          </a>
        </Typography>
      </Alert>

      <Alert severity="info" style={{ marginBottom: 16 }}>
        <Typography variant="body2">
          Cookies help bypass YouTube's bot detection and enable downloading members-only videos when the account holds an active channel membership.
        </Typography>
      </Alert>

      <Accordion className="mb-4">
        <AccordionSummary>Refresh cookies automatically with YOUTARR_COOKIES_FILE</AccordionSummary>
        <AccordionDetails className="space-y-3 text-sm">
          <p>
            Have a script or service refresh your cookie file on the server? Set{' '}
            <code>YOUTARR_COOKIES_FILE</code> to its path inside the container and enable cookies here.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              With the bundled Compose setup, have your script write a Netscape cookie file at{' '}
              <code>config/cookies.external.txt</code> (up to 1 MB, readable by Youtarr).
            </li>
            <li>
              Add <code className="break-all">YOUTARR_COOKIES_FILE=/app/config/cookies.external.txt</code>{' '}
              to your <code>.env</code> file and recreate the container once. No Compose edits are needed for this location.
            </li>
            <li>Turn on Enable Cookies and save your configuration. No upload is needed.</li>
          </ol>
          <p>
            New operations pick up updates automatically. Youtarr uses yt-dlp to check a private copy
            and never modifies your source. Have your script write a temporary file and rename it over
            the source when complete.
          </p>
          <p>
            If the file cannot be used, operations continue without cookies and a warning appears here
            and in the logs. Downloads needing authentication may fail. A valid replacement restores
            cookie use automatically; validation does not verify your YouTube session.
          </p>
          <p>
            This replaces uploads while the variable is set. Unset it and recreate the container to
            return to uploaded cookies.
          </p>
          <a
            href="https://github.com/DialmasterOrg/Youtarr/blob/dev/docs/CONFIG.md#external-cookie-file"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-primary underline"
          >
            Setup guide and other mount locations
          </a>
        </AccordionDetails>
      </Accordion>

      {externalCookies && (
        <Alert severity={externalCookies.ready && !externalCookies.warning ? 'info' : 'warning'} className="mb-4">
          <AlertTitle>Cookies managed externally</AlertTitle>
          <Typography variant="body2" className="break-all">
            Source: {externalCookies.path}
          </Typography>
          <Typography variant="body2">
            {config.cookiesEnabled
              ? 'Valid file updates apply to new operations without restarting. Youtarr does not modify the source file.'
              : 'Enable Cookies and save your configuration to use this file.'}
          </Typography>
          <Typography variant="body2">
            {externalCookies.error || 'yt-dlp loaded this file. This does not verify YouTube authentication.'}
          </Typography>
          {externalCookies.warning && (
            <Typography variant="body2">
              {externalCookies.warning}
            </Typography>
          )}
          {!externalCookies.ready && (
            <Typography variant="body2">
              Operations {config.cookiesEnabled ? 'will continue' : 'would run'} without cookies until a usable file is available.
              Downloads needing authentication may fail. Cookie use resumes automatically when enabled and a valid replacement is detected.
            </Typography>
          )}
          {externalCookies.lastModified && (
            <Typography variant="body2">
              Source last modified: {new Date(externalCookies.lastModified).toLocaleString()}
            </Typography>
          )}
          <Typography variant="body2">
            Uploads are unavailable while YOUTARR_COOKIES_FILE is set. Any previously uploaded cookies are preserved.
          </Typography>
          <Typography variant="caption" className="block text-muted-foreground">
            Status refreshes every 30 seconds while these settings are open.
          </Typography>
          <Button variant="outlined" size="small" onClick={refreshCookieStatus} className="mt-2">
            Refresh file status
          </Button>
        </Alert>
      )}

      <Grid container spacing={2}>
        {config.cookiesEnabled && !externalCookies && (
          <>
            <Grid item xs={12}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Button
                    variant="contained"
                    disabled={uploadingCookie}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingCookie ? 'Uploading...' : 'Upload Cookie File'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept=".txt,text/plain"
                    data-testid="cookie-file-input"
                    onChange={handleCookieUpload}
                  />
                  {cookieStatus?.customFileExists && (
                    <>
                      <Chip
                        label="Custom cookies uploaded"
                        color="success"
                        size="small"
                      />
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={deleteCookies}
                      >
                        Delete Custom Cookies
                      </Button>
                    </>
                  )}
                </div>
                <Typography variant="caption" style={{ color: 'var(--muted-foreground)' }}>
                  Upload a Netscape format cookie file exported from your browser.
                  File must be less than 1MB.
                </Typography>
              </div>
            </Grid>

            {cookieStatus && (
              <Grid item xs={12}>
                <Typography variant="caption" style={{ color: 'var(--muted-foreground)' }}>
                  Status: {cookieStatus.customFileExists ?
                    'Using custom cookies' :
                    'No cookie file uploaded'}
                </Typography>
              </Grid>
            )}
          </>
        )}
      </Grid>
    </ConfigurationAccordion>
  );
};
