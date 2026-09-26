import React from 'react';
import { Alert, Typography } from '../../../ui';
import { CookieDetails } from '../../types';
import { formatDate } from '../../../../utils/formatters';

export interface CookieFact {
  label: string;
  value: React.ReactNode;
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// Rows describing the login cookies; empty when the file has none, since the
// warning below already says so.
export function getLoginCookieFacts(details: CookieDetails): CookieFact[] {
  if (details.loginCookiesFound === 0) {
    return [{ label: 'Login cookies', value: 'None found' }];
  }
  const { earliestExpiry, earliestExpiryName, sessionLoginCookies, expiredLoginCookies } = details;
  const found = sessionLoginCookies > 0
    ? `${details.loginCookiesFound} found (${plural(sessionLoginCookies, 'session cookie')})`
    : `${details.loginCookiesFound} found`;
  let expiry: React.ReactNode = 'Session cookies only';
  if (earliestExpiry) {
    const when = `${formatDate(earliestExpiry)} (${earliestExpiryName})`;
    expiry = expiredLoginCookies > 0 ? <span className="text-warning">Expired {when}</span> : when;
  }
  return [
    { label: 'Login cookies', value: found },
    { label: 'Earliest expiry', value: expiry },
  ];
}

export const CookieFactList: React.FC<{ facts: CookieFact[] }> = ({ facts }) => (
  <dl className="m-0 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-y-1.5">
    {facts.map(({ label, value }) => (
      <React.Fragment key={label}>
        <dt className="mt-3 text-xs text-muted-foreground first:mt-0 sm:mt-0 sm:text-sm">{label}</dt>
        <dd className="m-0 min-w-0 break-words">{value}</dd>
      </React.Fragment>
    ))}
  </dl>
);

export const CookieDetailsWarning: React.FC<{ details: CookieDetails }> = ({ details }) => {
  if (details.loginCookiesFound === 0) {
    return (
      <Alert severity="warning">
        <Typography variant="body2">
          No YouTube login cookies found. This file looks like it was exported from a signed-out
          browser. Export cookies again while signed in to YouTube.
        </Typography>
      </Alert>
    );
  }
  if (details.expiredLoginCookies > 0) {
    return (
      <Alert severity="warning">
        <Typography variant="body2">
          {plural(details.expiredLoginCookies, 'login cookie')} expired. Export fresh cookies from a
          browser signed in to YouTube.
        </Typography>
      </Alert>
    );
  }
  return null;
};
