import { SETTINGS_PAGES } from './SettingsIndex';

/** Pages under /settings/<key> that render their own heading row. */
const OWN_HEADING = new Set(['library']);

export interface SettingsHeading {
  /** Title of the page under /settings, or null on the index itself */
  subPage: string | null;
}

/** The "Settings / {title}" heading from the first path segment, or null when the page renders its own heading. */
export function settingsHeading(pathname: string): SettingsHeading | null {
  const segment = pathname.replace(/^\/settings\/?/, '').split('/')[0];
  if (!segment) return { subPage: null };
  if (OWN_HEADING.has(segment)) return null;
  const page = SETTINGS_PAGES.find((entry) => entry.key === segment);
  return { subPage: page?.title || segment };
}
