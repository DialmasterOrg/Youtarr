import React from 'react';
import { Typography, Accordion, AccordionSummary, AccordionDetails } from '../../ui';
import { ConfigurationAccordion } from '../common/ConfigurationAccordion';
import { useCookieManagement } from '../hooks/useCookieManagement';
import { CookieFileCard } from './components/CookieFileCard';
import { ConfigState, CookieStatus, SnackbarState } from '../types';

interface CookieConfigSectionProps {
  token: string | null;
  config: ConfigState;
  setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
  onMobileTooltipClick?: (text: string) => void;
}

function getChip(cookiesEnabled: boolean, status: CookieStatus | null) {
  const external = status?.external;
  if (cookiesEnabled && external && (!external.ready || external.warning)) {
    return { label: 'External cookie warning', color: 'warning' as const, issue: true };
  }
  const details = status?.details;
  if (cookiesEnabled && details && (details.loginCookiesFound === 0 || details.expiredLoginCookies > 0)) {
    return { label: 'Cookies need attention', color: 'warning' as const, issue: true };
  }
  return cookiesEnabled
    ? { label: 'Cookies Enabled', color: 'success' as const, issue: false }
    : { label: 'Cookies Disabled', color: 'default' as const, issue: false };
}

const ExternalFileSetupHelp: React.FC = () => (
  <Accordion>
    <AccordionSummary>Advanced: refresh cookies automatically with YOUTARR_COOKIES_FILE</AccordionSummary>
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
        cookie use automatically.
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
);

export const CookieConfigSection: React.FC<CookieConfigSectionProps> = ({
  token,
  config,
  setConfig,
  onConfigChange,
  setSnackbar,
}) => {
  const {
    cookieStatus,
    refreshCookieStatus,
    uploadingCookie,
    uploadCookieFile,
    deleteCookies,
  } = useCookieManagement({ token, setConfig, setSnackbar });
  const externalCookies = cookieStatus?.external;
  const chip = getChip(config.cookiesEnabled, cookieStatus);
  // External files stay visible while cookies are off so setup problems show up before enabling.
  const showFileCard = Boolean(cookieStatus) && (config.cookiesEnabled || Boolean(externalCookies));

  return (
    <ConfigurationAccordion
      title="Cookie Configuration"
      chipLabel={chip.label}
      chipColor={chip.color}
      statusBanner={{
        enabled: config.cookiesEnabled,
        label: 'Enable Cookies',
        onToggle: (enabled) => onConfigChange({ cookiesEnabled: enabled }),
        onText: externalCookies && !externalCookies.ready ? 'Cookies enabled; external file unavailable' : 'Cookies Enabled',
        offText: 'Cookies Disabled',
        successWhenEnabled: !chip.issue,
      }}
      defaultExpanded={false}
    >
      <div className="space-y-4">
        <Typography variant="body2" className="text-muted-foreground">
          Cookies let yt-dlp act as a signed-in YouTube account, which can get past
          "Sign in to confirm you're not a bot" checks.
          {!config.cookiesEnabled && !externalCookies && ' Turn on Enable Cookies to add a cookie file.'}{' '}
          <a
            href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            yt-dlp cookie guide
          </a>
        </Typography>

        {showFileCard && cookieStatus && (
          <CookieFileCard
            key={cookieStatus.details?.lastModified ?? externalCookies?.lastModified ?? 'none'}
            token={token}
            cookieStatus={cookieStatus}
            cookiesEnabled={config.cookiesEnabled}
            uploading={uploadingCookie}
            onUpload={uploadCookieFile}
            onDelete={() => { void deleteCookies(); }}
            onRefresh={() => { void refreshCookieStatus(); }}
          />
        )}

        <ExternalFileSetupHelp />
      </div>
    </ConfigurationAccordion>
  );
};
