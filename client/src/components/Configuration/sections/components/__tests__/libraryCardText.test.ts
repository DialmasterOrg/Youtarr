import { checkCell } from '../libraryCardText';
import type { CheckStatus } from '../../../../../utils/libraryAttention';

type CheckCellArgs = Parameters<typeof checkCell>[0];

const base: CheckStatus = { kind: 'full', running: false, checked: ['Plex', 'Jellyfin'], unreachable: [], lastCheckedAt: 0, hasEarlierResults: true, error: null };
const args = (status: Partial<CheckStatus>, extra: Partial<CheckCellArgs> = {}): CheckCellArgs => ({
  status: { ...base, ...status }, attentionCount: 0, configured: ['plex', 'jellyfin'], now: 60_000, timeZone: null, ...extra,
});
const NOTHING_YET: Partial<CheckStatus> = { checked: [], lastCheckedAt: null, hasEarlierResults: false };

describe('checkCell', () => {
  test('a full check with nothing to fix', () => {
    expect(checkCell(args({}))).toMatchObject({ tone: 'success', value: 'All folders OK', sub: 'Checked with Plex and Jellyfin. Emby is not set up.' });
  });

  test('a partial check never says All folders OK', () => {
    expect(checkCell(args({ kind: 'partial', checked: ['Plex'], unreachable: [{ name: 'Jellyfin', error: 'x' }] }))).toMatchObject({
      value: 'No issues found', sub: "Checked with Plex. Jellyfin couldn't be reached. Emby is not set up.",
    });
  });

  test('attention counts and keeps the partial qualification', () => {
    expect(checkCell(args({ kind: 'partial', checked: ['Plex'], unreachable: [{ name: 'Jellyfin', error: 'x' }] }, { attentionCount: 2 })))
      .toMatchObject({ tone: 'warning', value: '2 need attention', sub: "Checked with Plex. Jellyfin couldn't be reached. Emby is not set up." });
  });

  test('a failed check with earlier results says when it last worked', () => {
    expect(checkCell(args({ kind: 'failed', error: 'boom' }))).toMatchObject({ sub: 'Last checked 1 min ago. The latest check failed.', retry: true });
  });

  test('a failed check without earlier results shows the error', () => {
    expect(checkCell(args({ kind: 'failed', error: 'boom', hasEarlierResults: false, lastCheckedAt: null }))).toMatchObject({
      tone: 'destructive', value: "Couldn't check", sub: 'boom', retry: true,
    });
  });

  test('every server unreachable names them joined with or', () => {
    expect(checkCell(args({ kind: 'unreachable', checked: [], unreachable: [{ name: 'Plex', error: 'x' }, { name: 'Jellyfin', error: 'y' }] })))
      .toMatchObject({ value: "Couldn't reach Plex or Jellyfin", retry: true });
  });

  test('a failed re-check after every server was unreachable stays a failure, never a success', () => {
    expect(checkCell(args({ kind: 'failed', error: 'boom', checked: [], unreachable: [{ name: 'Plex', error: 'x' }] }))).toMatchObject({
      tone: 'destructive', icon: 'x', value: "Couldn't reach Plex", sub: 'Last checked 1 min ago. The latest check failed.', retry: true,
    });
  });

  test('no media server configured links the server settings', () => {
    expect(checkCell(args({ kind: 'none' }, { configured: [] }))).toMatchObject({ value: 'Not checked', linksServers: true });
  });

  test('a running first check shows the spinner', () => {
    expect(checkCell(args({ ...NOTHING_YET, kind: 'checking', running: true }))).toMatchObject({
      icon: 'spinner', value: 'Checking media servers...', sub: '',
    });
  });

  test('a check that has not started yet reads as checking, not as a result', () => {
    expect(checkCell(args({ ...NOTHING_YET, kind: 'unchecked' }))).toMatchObject({
      icon: 'spinner', value: 'Checking media servers...', sub: '', retry: false,
    });
  });

  test('servers not known yet reads as checking, not as no media server', () => {
    expect(checkCell(args({ ...NOTHING_YET, kind: 'none' }, { configured: [], serversKnown: false }))).toMatchObject({
      icon: 'spinner', value: 'Checking media servers...', linksServers: false,
    });
  });
});
