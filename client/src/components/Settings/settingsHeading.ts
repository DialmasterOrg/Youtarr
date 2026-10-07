import { SETTINGS_PAGES } from './SettingsIndex';

/** Pages under /settings/<key> that render their own heading row. */
const OWN_HEADING = new Set(['library']);

/** "Settings / {title}" from the first path segment, or null when the page renders its own heading. */
export function settingsHeading(pathname: string): string | null {
  const segment = pathname.replace(/^\/settings\/?/, '').split('/')[0];
  if (!segment) return 'Settings';
  if (OWN_HEADING.has(segment)) return null;
  const page = SETTINGS_PAGES.find((entry) => entry.key === segment);
  return `Settings / ${page?.title || segment}`;
}
