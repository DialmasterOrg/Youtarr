import { formatDateTimeInZone } from '../../../../utils/formatters';
import { MIN_SCHEDULE_INTERVAL_MINUTES } from '../../schedules';
import { ScheduleRunAvailability } from '../../hooks/useScheduleStatus';

export interface RunNowHint {
  text: string;
  link?: { to: string; label: string };
}

interface RunNowHintInput {
  availability: ScheduleRunAvailability;
  settingsLabel: string;
  featureOnInForm: boolean;
  timeZone?: string | null;
}

function availableAgain(availableAt: string | null, timeZone?: string | null): string {
  return availableAt ? ` Available again at ${formatDateTimeInZone(availableAt, timeZone)}.` : '';
}

// Why Run now is unavailable, in words, with a link to where the user can fix
// it. Null when it is available, or when the card already says why (running).
export function describeRunNowBlock({ availability, settingsLabel, featureOnInForm, timeZone }: RunNowHintInput): RunNowHint | null {
  if (availability.available) return null;
  const message = availability.message ?? 'Run now is not available right now.';
  switch (availability.reason) {
    case 'running':
    case 'managed':
      return null;
    case 'disabled':
      return featureOnInForm
        ? { text: 'Save your settings first: Run now uses the saved settings.' }
        : { text: `Available once this is turned on in ${settingsLabel}.` };
    case 'cooldown':
      return { text: `Ran less than ${MIN_SCHEDULE_INTERVAL_MINUTES} minutes ago.${availableAgain(availability.availableAt, timeZone)}` };
    case 'youtube-throttled':
      return { text: `${message}${availableAgain(availability.availableAt, timeZone)}` };
    case 'downloads-paused':
      return { text: message, link: { to: '/settings/storage-limits', label: 'Storage limits' } };
    case 'no-media-server':
      return { text: message, link: { to: '/settings/watch-status', label: 'Watch status settings' } };
    case 'downloads-active':
      return { text: message, link: { to: '/downloads/activity', label: 'Download activity' } };
    default:
      return { text: message };
  }
}
