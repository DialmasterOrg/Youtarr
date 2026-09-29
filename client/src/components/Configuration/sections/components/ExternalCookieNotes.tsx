import React from 'react';
import { Alert, Typography } from '../../../ui';
import { CookieStatus } from '../../types';

interface ExternalCookieNotesProps {
  external: NonNullable<CookieStatus['external']>;
  cookiesEnabled: boolean;
}

export const ExternalCookieNotes: React.FC<ExternalCookieNotesProps> = ({ external, cookiesEnabled }) => (
  <>
    {external.error && (
      <Alert severity="error">
        <Typography variant="body2">{external.error}</Typography>
        <Typography variant="body2">
          Operations {cookiesEnabled ? 'will continue' : 'would run'} without cookies until a usable file is
          available, so downloads needing authentication may fail. Cookie use resumes automatically when a
          valid replacement is detected.
        </Typography>
      </Alert>
    )}
    {external.warning && (
      <Alert severity="warning">
        <Typography variant="body2">{external.warning}</Typography>
      </Alert>
    )}
    <Typography variant="body2" className="text-muted-foreground">
      {cookiesEnabled
        ? 'Valid file updates apply to new operations without restarting. Youtarr never modifies the source file.'
        : 'Enable Cookies and save your configuration to use this file.'}
      {' '}Uploads are unavailable while YOUTARR_COOKIES_FILE is set; previously uploaded cookies are kept.
      Status refreshes every 30 seconds.
    </Typography>
  </>
);
