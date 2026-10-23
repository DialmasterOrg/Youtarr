import type { MediaServerType } from '../../../../types/libraryCheck';
import { CheckStatus, SERVER_NAMES, SERVER_ORDER, joinNames, timeAgo } from '../../../../utils/libraryAttention';

/** The Core card's Media server check cell (Core 3.4). */
export interface CheckCell {
  tone: 'muted' | 'success' | 'warning' | 'destructive' | 'foreground';
  icon: 'spinner' | 'info' | 'check' | 'alert' | 'x';
  value: string;
  sub: string;
  /** Offer Try again */
  retry: boolean;
  /** The sub line links Plex, Jellyfin and Emby to their settings pages */
  linksServers: boolean;
}

/** The no-media-server sub line around its server names, so the card can link each name. */
export const NO_SERVERS_LEAD = "No media server is connected, so Youtarr can't check your libraries. Libraries you set up by hand keep "
  + 'working; connect ';
export const NO_SERVERS_TAIL = ' to check them.';
const NO_SERVERS_SUB = `${NO_SERVERS_LEAD}${joinNames(SERVER_ORDER.map((type) => SERVER_NAMES[type]), 'or')}${NO_SERVERS_TAIL}`;

const CHECKING: CheckCell = {
  tone: 'muted', icon: 'spinner', value: 'Checking media servers...', sub: '', retry: false, linksServers: false,
};

function notSetUp(configured: readonly MediaServerType[]): string {
  const missing = SERVER_ORDER.filter((type) => !configured.includes(type)).map((type) => SERVER_NAMES[type]);
  if (missing.length === 0 || missing.length === SERVER_ORDER.length) return '';
  return ` ${joinNames(missing)} ${missing.length === 1 ? 'is' : 'are'} not set up.`;
}

function checkedWith(status: CheckStatus, configured: readonly MediaServerType[]): string {
  const unreachable = status.unreachable.map((server) => ` ${server.name} couldn't be reached.`).join('');
  return `Checked with ${joinNames(status.checked)}.${unreachable}${notSetUp(configured)}`;
}

export function checkCell({ status, attentionCount, configured, now, timeZone, serversKnown = true }: {
  status: CheckStatus; attentionCount: number; configured: readonly MediaServerType[]; now: number; timeZone: string | null;
  /** False while the configured servers are still loading and the check has no answer yet */
  serversKnown?: boolean;
}): CheckCell {
  const base = { retry: false, linksServers: false };
  // Until the servers are known and the first check has answered, show it running, never a result.
  if (!serversKnown) return CHECKING;
  if (status.kind === 'none') return { ...base, tone: 'foreground', icon: 'info', value: 'Not checked', sub: NO_SERVERS_SUB, linksServers: true };
  if (!status.hasEarlierResults && (status.kind === 'checking' || status.kind === 'unchecked' || status.running)) return CHECKING;
  if (status.kind === 'failed' && !status.hasEarlierResults) {
    return { tone: 'destructive', icon: 'x', value: "Couldn't check", sub: status.error || 'Could not check the media server libraries', retry: true, linksServers: false };
  }
  const failedSub = status.kind === 'failed' && status.lastCheckedAt !== null
    ? `Last checked ${timeAgo(status.lastCheckedAt, now, timeZone)}. The latest check failed.` : null;
  // Also after a failed re-check: the earlier results checked no server, so they are no success.
  if (status.checked.length === 0 && status.unreachable.length > 0) {
    return {
      tone: 'destructive', icon: 'x', value: `Couldn't reach ${joinNames(status.unreachable.map((server) => server.name), 'or')}`,
      sub: failedSub ?? '', retry: true, linksServers: false,
    };
  }
  if (attentionCount > 0) {
    return {
      tone: 'warning', icon: 'alert', value: `${attentionCount} ${attentionCount === 1 ? 'needs' : 'need'} attention`,
      sub: failedSub ?? checkedWith(status, configured), retry: Boolean(failedSub), linksServers: false,
    };
  }
  return {
    tone: 'success', icon: 'check', value: status.unreachable.length > 0 ? 'No issues found' : 'All folders OK',
    sub: failedSub ?? checkedWith(status, configured), retry: Boolean(failedSub), linksServers: false,
  };
}
