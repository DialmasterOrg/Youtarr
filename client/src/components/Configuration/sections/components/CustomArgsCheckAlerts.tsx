import React from 'react';
import { Alert, AlertTitle, Typography } from '../../../ui';
import { CustomArgEntry, CustomArgsCheck } from '../../types';

const LIST_STYLE = { margin: '4px 0 0', paddingLeft: 20 };

function CustomArgEntryList({ entries }: { entries: CustomArgEntry[] }) {
  return (
    <ul style={LIST_STYLE}>
      {entries.map((entry, index) => (
        <li key={`${entry.given}-${index}`}>
          <code>{entry.given}</code> - {entry.reason}
        </li>
      ))}
    </ul>
  );
}

interface CustomArgsCheckAlertsProps {
  check: Partial<CustomArgsCheck>;
  blockedTitle: string;
  errorsTitle: string;
  warningsTitle: string;
  // Shown under the blocked list only when nothing else was dropped (a parse
  // error can drop the options after it, or all of them for an open quote).
  blockedNote?: string;
}

/**
 * The server's allowlist check of custom yt-dlp args, as one alert per kind:
 * blocked options, options that could not be read, and risky options.
 */
export function CustomArgsCheckAlerts({
  check,
  blockedTitle,
  errorsTitle,
  warningsTitle,
  blockedNote,
}: CustomArgsCheckAlertsProps) {
  const blocked = check.blocked ?? [];
  const errors = check.errors ?? [];
  const warnings = check.warnings ?? [];
  return (
    <>
      {blocked.length > 0 && (
        <Alert severity='error' style={{ marginTop: 8 }}>
          <AlertTitle>{blockedTitle}</AlertTitle>
          <CustomArgEntryList entries={blocked} />
          {blockedNote && errors.length === 0 && (
            <Typography variant='body2' style={{ marginTop: 4 }}>
              {blockedNote}
            </Typography>
          )}
        </Alert>
      )}

      {errors.length > 0 && (
        <Alert severity='error' style={{ marginTop: 8 }}>
          <AlertTitle>{errorsTitle}</AlertTitle>
          <ul style={LIST_STYLE}>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert severity='warning' style={{ marginTop: 8 }}>
          <AlertTitle>{warningsTitle}</AlertTitle>
          <CustomArgEntryList entries={warnings} />
        </Alert>
      )}
    </>
  );
}
